import express from "express";
import { createServer as createViteServer } from "vite";
import { TwitterApi } from "twitter-api-v2";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const ACCOUNTS_FILE = path.resolve("accounts.json");
const LOGS_FILE = path.resolve("success_logs.txt");
const UPLOADS_DIR = path.resolve("uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Helper to read/write accounts
const getAccounts = () => {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
};

const saveAccounts = (accounts: any[]) => {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
};

const logSuccess = (url: string) => {
  fs.appendFileSync(LOGS_FILE, `${new Date().toISOString()}: ${url}\n`);
};

// Twitter OAuth 1.0a state (in-memory for simple flow)
const oauthState: Record<string, string> = {};

// --- API ROUTES ---

// 1. Twitter Auth
app.get("/api/auth/twitter", async (req, res) => {
  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY!,
      appSecret: process.env.TWITTER_CONSUMER_SECRET!,
    });

    const callbackUrl = `${process.env.APP_URL}/api/auth/twitter/callback`;
    const authLink = await client.generateAuthLink(callbackUrl);

    oauthState[authLink.oauth_token] = authLink.oauth_token_secret;

    res.json({ url: authLink.url });
  } catch (error: any) {
    console.error("Twitter Auth Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/twitter/callback", async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_token || !oauth_verifier) {
    return res.status(400).send("Missing tokens");
  }

  const oauth_token_secret = oauthState[oauth_token as string];

  if (!oauth_token_secret) {
    return res.status(400).send("Invalid or expired session");
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_CONSUMER_KEY!,
      appSecret: process.env.TWITTER_CONSUMER_SECRET!,
      accessToken: oauth_token as string,
      accessSecret: oauth_token_secret,
    });

    const { client: loggedClient, accessToken, accessSecret, screenName, userId } = await client.login(oauth_verifier as string);

    const accounts = getAccounts();
    const existingIndex = accounts.findIndex((a: any) => a.userId === userId);

    const accountData = {
      userId,
      screenName,
      accessToken,
      accessSecret,
      addedAt: new Date().toISOString(),
    };

    if (existingIndex > -1) {
      accounts[existingIndex] = accountData;
    } else {
      accounts.push(accountData);
    }

    saveAccounts(accounts);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', screenName: '${screenName}' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful for @${screenName}. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Twitter Callback Error:", error);
    res.status(500).send("Authentication failed: " + error.message);
  }
});

app.get("/api/accounts", (req, res) => {
  const accounts = getAccounts().map(({ userId, screenName, addedAt }: any) => ({ userId, screenName, addedAt }));
  res.json(accounts);
});

app.delete("/api/accounts/:userId", (req, res) => {
  const { userId } = req.params;
  const accounts = getAccounts().filter((a: any) => a.userId !== userId);
  saveAccounts(accounts);
  res.json({ success: true });
});

// 2. Fetch Tweet Content
app.get("/api/tweet-details", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const tweetId = (url as string).split("/").pop()?.split("?")[0];
  if (!tweetId) return res.status(400).json({ error: "Invalid Twitter URL" });

  try {
    // We need at least one account to fetch details, or use app-only auth
    // Using app-only auth for fetching is easier if we have consumer keys
    const client = new TwitterApi(process.env.TWITTER_CONSUMER_KEY!);
    const appOnlyClient = await client.appLogin();
    
    // Fetch tweet with expansions for media and text
    const tweet = await appOnlyClient.v2.singleTweet(tweetId, {
      "tweet.fields": ["text", "author_id", "created_at", "entities"],
      expansions: ["attachments.media_keys", "author_id"],
      "media.fields": ["url", "preview_image_url", "type"],
    });

    res.json(tweet);
  } catch (error: any) {
    console.error("Fetch Tweet Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. AI Generation
app.post("/api/generate-comment", async (req, res) => {
  const { tweetContent, persona, imageAnalysis } = req.body;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, engaging Twitter reply based on the following:
      Tweet Content: ${tweetContent}
      Persona/Tone: ${persona}
      ${imageAnalysis ? `Image Context: ${imageAnalysis}` : ""}
      
      Requirements:
      - Keep it under 280 characters.
      - Sound natural and human.
      - Match the persona perfectly.
      - Do not use hashtags unless requested.
      - Return ONLY the text of the reply.`,
    });

    const response = await model;
    res.json({ comment: response.text });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/analyze-image", upload.single("image"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: req.file.mimetype,
          },
        },
        { text: "Describe what is happening in this image briefly, focusing on details that would be relevant for a Twitter reply." },
      ],
    });

    // Clean up file
    fs.unlinkSync(req.file.path);

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error("Image Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Batch Posting
app.post("/api/batch-reply", upload.single("media"), async (req: any, res) => {
  const { tweetId, comments, accountIds } = req.body; // accountIds: string[], comments: string[] (one for each or same)
  const mediaPath = req.file?.path;

  const accounts = getAccounts().filter((a: any) => accountIds.includes(a.userId));
  const results: any[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const comment = Array.isArray(comments) ? comments[i % comments.length] : comments;

    try {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY!,
        appSecret: process.env.TWITTER_CONSUMER_SECRET!,
        accessToken: account.accessToken,
        accessSecret: account.accessSecret,
      });

      let mediaId: string | undefined;
      if (mediaPath) {
        mediaId = await client.v1.uploadMedia(mediaPath);
      }

      const tweet = await client.v2.reply(comment, tweetId, {
        media: mediaId ? { media_ids: [mediaId] } : undefined,
      });

      const tweetUrl = `https://twitter.com/${account.screenName}/status/${tweet.data.id}`;
      logSuccess(tweetUrl);
      results.push({ screenName: account.screenName, success: true, url: tweetUrl });
    } catch (error: any) {
      console.error(`Reply Error for @${account.screenName}:`, error);
      results.push({ screenName: account.screenName, success: false, error: error.message });
    }
  }

  if (mediaPath) fs.unlinkSync(mediaPath);

  res.json({ results });
});

app.post("/api/batch-post", upload.single("media"), async (req: any, res) => {
  const { text, accountIds } = req.body;
  const mediaPath = req.file?.path;

  const accounts = getAccounts().filter((a: any) => accountIds.includes(a.userId));
  const results: any[] = [];

  for (const account of accounts) {
    try {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY!,
        appSecret: process.env.TWITTER_CONSUMER_SECRET!,
        accessToken: account.accessToken,
        accessSecret: account.accessSecret,
      });

      let mediaId: string | undefined;
      if (mediaPath) {
        mediaId = await client.v1.uploadMedia(mediaPath);
      }

      const tweet = await client.v2.tweet(text, {
        media: mediaId ? { media_ids: [mediaId] } : undefined,
      });

      const tweetUrl = `https://twitter.com/${account.screenName}/status/${tweet.data.id}`;
      logSuccess(tweetUrl);
      results.push({ screenName: account.screenName, success: true, url: tweetUrl });
    } catch (error: any) {
      console.error(`Post Error for @${account.screenName}:`, error);
      results.push({ screenName: account.screenName, success: false, error: error.message });
    }
  }

  if (mediaPath) fs.unlinkSync(mediaPath);

  res.json({ results });
});

app.get("/api/logs", (req, res) => {
  if (!fs.existsSync(LOGS_FILE)) return res.json({ logs: [] });
  const content = fs.readFileSync(LOGS_FILE, "utf-8");
  res.json({ logs: content.split("\n").filter(Boolean) });
});

app.get("/api/download-logs", (req, res) => {
  if (!fs.existsSync(LOGS_FILE)) return res.status(404).send("No logs found");
  res.download(LOGS_FILE, "twitter_success_logs.txt");
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
