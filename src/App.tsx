/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Twitter, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Send, 
  Image as ImageIcon, 
  Loader2, 
  ExternalLink, 
  RefreshCw,
  LayoutDashboard,
  FileText,
  UserCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  Activity,
  Award,
  Download,
  CloudDownload,
  Box,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";

type Account = {
  userId: string;
  screenName: string;
  addedAt: string;
};

type Log = string;

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "network" | "reply" | "composer" | "setup">("dashboard");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Replier State
  const [tweetUrl, setTweetUrl] = useState("");
  const [tweetDetails, setTweetDetails] = useState<any>(null);
  const [persona, setPersona] = useState("Friendly and supportive");
  const [generatedComments, setGeneratedComments] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [replierMedia, setReplierMedia] = useState<File | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState("");

  // Composer State
  const [composerText, setComposerText] = useState("");
  const [composerMedia, setComposerMedia] = useState<File | null>(null);
  const [composerAccounts, setComposerAccounts] = useState<string[]>([]);
  const [networkSelectedAccounts, setNetworkSelectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    fetchAccounts();
    fetchLogs();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        fetchAccounts();
        showStatus("success", `Account @${event.data.screenName} connected successfully!`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get("/api/accounts");
      setAccounts(res.data);
    } catch (e) {
      console.error("Failed to fetch accounts", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get("/api/logs");
      setLogs(res.data.logs);
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  };

  const showStatus = (type: "success" | "error", message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  };

  const connectTwitter = async () => {
    try {
      const res = await axios.get("/api/auth/twitter");
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(res.data.url, "twitter_auth", `width=${width},height=${height},left=${left},top=${top}`);
    } catch (e: any) {
      showStatus("error", "Failed to start Twitter authentication");
    }
  };

  const deleteAccount = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;
    try {
      await axios.delete(`/api/accounts/${userId}`);
      fetchAccounts();
      showStatus("success", "Account removed");
    } catch (e) {
      showStatus("error", "Failed to remove account");
    }
  };

  const fetchTweetDetails = async () => {
    if (!tweetUrl) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/tweet-details?url=${encodeURIComponent(tweetUrl)}`);
      setTweetDetails(res.data);
      showStatus("success", "Tweet details fetched");
    } catch (e: any) {
      showStatus("error", "Failed to fetch tweet details: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const analyzeImage = async (file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await axios.post("/api/analyze-image", formData);
      setImageAnalysis(res.data.analysis);
      showStatus("success", "Image analyzed");
    } catch (e) {
      showStatus("error", "Image analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const generateComment = async () => {
    if (!tweetDetails) return;
    setLoading(true);
    try {
      const res = await axios.post("/api/generate-comment", {
        tweetContent: tweetDetails.data.text,
        persona,
        imageAnalysis
      });
      setGeneratedComments([res.data.comment]);
      showStatus("success", "Comment generated");
    } catch (e) {
      showStatus("error", "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchReply = async () => {
    if (!tweetDetails || selectedAccounts.length === 0 || generatedComments.length === 0) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("tweetId", tweetDetails.data.id);
    formData.append("comments", JSON.stringify(generatedComments));
    formData.append("accountIds", JSON.stringify(selectedAccounts));
    if (replierMedia) formData.append("media", replierMedia);

    try {
      const res = await axios.post("/api/batch-reply", formData);
      showStatus("success", `Batch reply complete. ${res.data.results.filter((r: any) => r.success).length} successful.`);
      fetchLogs();
    } catch (e) {
      showStatus("error", "Batch reply failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPost = async () => {
    if (!composerText || composerAccounts.length === 0) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("text", composerText);
    formData.append("accountIds", JSON.stringify(composerAccounts));
    if (composerMedia) formData.append("media", composerMedia);

    try {
      const res = await axios.post("/api/batch-post", formData);
      showStatus("success", `Batch post complete. ${res.data.results.filter((r: any) => r.success).length} successful.`);
      fetchLogs();
    } catch (e) {
      showStatus("error", "Batch post failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = () => {
    window.open("/api/download-logs", "_blank");
  };

  return (
    <div className="min-h-screen bg-brand-bg text-slate-200 font-sans selection:bg-sky-500/30 flex">
      {/* Status Toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-0 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
              status.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {status.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-bold font-display tracking-wide">{status.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-[300px] bg-[#0f172a] border-r border-slate-800 flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white leading-none font-display">X-AGENT</h1>
            <p className="text-[10px] font-bold text-sky-400 tracking-[0.3em] mt-1 font-mono uppercase">Swarm Control</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4 px-2 font-mono">Operation Center</p>
          <nav className="space-y-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "network", label: "Agent Network", icon: Users },
              { id: "reply", label: "AI Swarm Reply", icon: Zap },
              { id: "composer", label: "Batch Composer", icon: Layers },
              { id: "setup", label: "Setup Guide", icon: FileText },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id 
                    ? "bg-sky-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]" 
                    : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
              >
                <item.icon size={18} className={activeTab === item.id ? "text-white" : "group-hover:text-sky-400"} />
                <span className="font-bold text-sm font-display tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-6">
          <div className="px-2">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2 font-mono">API Status</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-500 tracking-wider font-mono">ONLINE</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            </div>
          </div>

          <button
            onClick={connectTwitter}
            className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-display"
          >
            <Plus size={18} className="text-sky-400" />
            <span className="text-sm">Add Agent (OAuth1.0a)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <header className="flex justify-between items-start">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight mb-2 font-display uppercase">System Overview</h2>
                  <p className="text-slate-400 font-medium font-display">Real-time status of your AI social swarm.</p>
                </div>
                <button 
                  onClick={downloadLogs}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-sky-400 font-bold px-6 py-3 rounded-xl flex items-center gap-3 transition-all shadow-xl font-display"
                >
                  <CloudDownload size={18} />
                  Download All Links
                </button>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "CONNECTED AGENTS", value: accounts.length, icon: Users, color: "sky" },
                  { label: "VERIFIED STATUS", value: accounts.length, icon: Award, color: "amber" },
                  { label: "TOTAL POSTS", value: logs.length, icon: Send, color: "purple" },
                  { label: "SYSTEM HEALTH", value: "100%", icon: Activity, color: "emerald" },
                ].map((stat, i) => (
                  <div key={i} className="glass-panel tech-border rounded-[2rem] p-8 relative overflow-hidden group hover:border-slate-700 transition-all">
                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-4 font-mono">{stat.label}</p>
                      <p className="text-5xl font-black text-white tracking-tighter font-display">{stat.value}</p>
                    </div>
                    <stat.icon size={80} className="absolute -right-4 -bottom-4 text-slate-800/30 group-hover:text-slate-700/40 transition-all rotate-12" />
                  </div>
                ))}
              </div>

              {/* Activity Section */}
              <div className="glass-panel tech-border rounded-[2rem] overflow-hidden">
                <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-sky-500 rounded-full" />
                    <h3 className="text-lg font-black text-white tracking-tight font-display uppercase">Swarm Activities</h3>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase font-mono">Agents Active</span>
                </div>
                <div className="min-h-[400px] flex flex-col items-center justify-center p-10 text-center">
                  {logs.length > 0 ? (
                    <div className="w-full space-y-4">
                      {logs.slice(-5).reverse().map((log, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50 hover:border-sky-500/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                              <CheckCircle2 size={18} className="text-sky-400" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-slate-200 truncate max-w-md font-mono">{log.split(": ")[1]}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase font-mono">{new Date(log.split(": ")[0]).toLocaleString()}</p>
                            </div>
                          </div>
                          <a href={log.split(": ")[1]} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 transition-colors">
                            <ExternalLink size={18} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6">
                        <Box size={32} className="text-slate-600" />
                      </div>
                      <h4 className="text-xl font-black text-slate-300 mb-2 font-display uppercase">Log instance empty</h4>
                      <p className="text-slate-500 font-medium font-display">Execute a batch operation to see activities.</p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "network" && (
            <motion.div
              key="network"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-tight mb-2 font-display uppercase">Agent Network</h2>
                  <p className="text-slate-400 font-medium font-display">Manage your authenticated swarm of social agents.</p>
                </div>
                <div className="flex gap-4">
                  {accounts.length > 0 && (
                    <button
                      onClick={() => {
                        if (networkSelectedAccounts.length === accounts.length) {
                          setNetworkSelectedAccounts([]);
                        } else {
                          setNetworkSelectedAccounts(accounts.map(a => a.userId));
                        }
                      }}
                      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold px-6 py-4 rounded-2xl transition-all font-display uppercase text-xs tracking-widest"
                    >
                      {networkSelectedAccounts.length === accounts.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                  <button
                    onClick={connectTwitter}
                    className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-[0_0_25px_rgba(14,165,233,0.4)] font-display uppercase tracking-wider"
                  >
                    <Plus size={18} />
                    Deploy New Agent
                  </button>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {accounts.map((acc) => (
                  <div 
                    key={acc.userId} 
                    onClick={() => {
                      setNetworkSelectedAccounts(prev => 
                        prev.includes(acc.userId) ? prev.filter(id => id !== acc.userId) : [...prev, acc.userId]
                      );
                    }}
                    className={`glass-panel tech-border rounded-[2rem] p-8 flex items-center justify-between group hover:border-slate-700 transition-all cursor-pointer ${
                      networkSelectedAccounts.includes(acc.userId) ? "border-sky-500 bg-sky-500/5 shadow-[0_0_20px_rgba(14,165,233,0.1)]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${
                        networkSelectedAccounts.includes(acc.userId) 
                          ? "bg-sky-500 border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.5)]" 
                          : "bg-sky-500/10 border-sky-500/20"
                      }`}>
                        <Twitter className={networkSelectedAccounts.includes(acc.userId) ? "text-white" : "text-sky-400"} size={32} />
                      </div>
                      <div>
                        <div className="text-xl font-black text-white tracking-tight font-display">@{acc.screenName}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 font-mono">Status: Active</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAccount(acc.userId);
                      }}
                      className="p-3 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                ))}
                {accounts.length === 0 && (
                  <div className="col-span-full py-32 text-center glass-panel border-dashed rounded-[2rem]">
                    <Users size={48} className="text-slate-700 mx-auto mb-6" />
                    <p className="text-slate-500 font-bold text-lg font-display uppercase tracking-widest">No agents deployed in the network.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "reply" && (
            <motion.div
              key="reply"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <header>
                <h2 className="text-4xl font-black text-white tracking-tight mb-2 font-display uppercase">AI Swarm Reply</h2>
                <p className="text-slate-400 font-medium font-display">Automated contextual engagement for the entire swarm.</p>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="glass-panel tech-border rounded-[2rem] p-8 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase ml-1 font-mono">Target Tweet URL</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={tweetUrl}
                          onChange={(e) => setTweetUrl(e.target.value)}
                          placeholder="https://x.com/user/status/..."
                          className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                        />
                        <button
                          onClick={fetchTweetDetails}
                          disabled={loading || !tweetUrl}
                          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20"
                        >
                          {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                        </button>
                      </div>
                    </div>

                    {tweetDetails && (
                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <p className="text-slate-300 font-medium leading-relaxed italic font-display">"{tweetDetails.data.text}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase ml-1 font-mono">Swarm Persona</label>
                        <div className="flex gap-4">
                          <select
                            value={["Friendly and supportive", "Witty and sarcastic", "Professional and informative", "Controversial and edgy", "Hype and energetic"].includes(persona) ? persona : "Custom"}
                            onChange={(e) => {
                              if (e.target.value === "Custom") {
                                setPersona("");
                              } else {
                                setPersona(e.target.value);
                              }
                            }}
                            className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-sky-500/50 font-bold text-sm font-display"
                          >
                            <option>Friendly and supportive</option>
                            <option>Witty and sarcastic</option>
                            <option>Professional and informative</option>
                            <option>Controversial and edgy</option>
                            <option>Hype and energetic</option>
                            <option value="Custom">Custom Persona...</option>
                          </select>
                          <div className="w-1/3 space-y-2">
                            <label className="w-full flex items-center justify-center gap-3 bg-slate-900/50 border border-slate-800 hover:border-sky-500/50 rounded-2xl px-6 py-4 cursor-pointer transition-all group">
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => e.target.files?.[0] && analyzeImage(e.target.files[0])}
                              />
                              <ImageIcon size={18} className="text-slate-500 group-hover:text-sky-400" />
                              <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 font-display">Analyze</span>
                            </label>
                          </div>
                        </div>
                        {(!["Friendly and supportive", "Witty and sarcastic", "Professional and informative", "Controversial and edgy", "Hype and energetic"].includes(persona) || persona === "") && (
                          <textarea
                            value={persona}
                            onChange={(e) => setPersona(e.target.value)}
                            placeholder="Describe your swarm's persona (e.g., 'A tech enthusiast who loves decentralization and uses lots of rocket emojis')..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-6 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none font-medium text-slate-200 font-mono text-sm h-32"
                          />
                        )}
                      </div>
                    </div>

                    <button
                      onClick={generateComment}
                      disabled={loading || !tweetDetails}
                      className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-xl font-display uppercase tracking-widest"
                    >
                      <Zap size={18} fill="currentColor" />
                      Generate Swarm Response
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="glass-panel tech-border rounded-[2rem] p-8 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase ml-1 font-mono">Response Preview</label>
                      <textarea
                        value={generatedComments[0] || ""}
                        onChange={(e) => setGeneratedComments([e.target.value])}
                        placeholder="AI generated response..."
                        className="w-full h-40 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none font-medium text-slate-200 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end ml-1">
                        <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase font-mono">Target Agents ({selectedAccounts.length})</label>
                        <button 
                          onClick={() => {
                            if (selectedAccounts.length === accounts.length) {
                              setSelectedAccounts([]);
                            } else {
                              setSelectedAccounts(accounts.map(a => a.userId));
                            }
                          }}
                          className="text-[10px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-widest font-mono transition-colors"
                        >
                          {selectedAccounts.length === accounts.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {accounts.map((acc) => (
                          <button
                            key={acc.userId}
                            onClick={() => {
                              setSelectedAccounts(prev => 
                                prev.includes(acc.userId) ? prev.filter(id => id !== acc.userId) : [...prev, acc.userId]
                              );
                            }}
                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                              selectedAccounts.includes(acc.userId)
                                ? "bg-sky-500/10 border-sky-500 text-sky-400"
                                : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700"
                            }`}
                          >
                            <span className="text-xs font-black truncate font-mono tracking-tighter">@{acc.screenName}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleBatchReply}
                      disabled={loading || selectedAccounts.length === 0 || !generatedComments[0]}
                      className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] disabled:opacity-50 font-display uppercase tracking-widest"
                    >
                      <Send size={18} />
                      Execute Swarm Reply
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "composer" && (
            <motion.div
              key="composer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto space-y-10"
            >
              <header className="text-center">
                <h2 className="text-4xl font-black text-white tracking-tight mb-2 font-display uppercase">Batch Composer</h2>
                <p className="text-slate-400 font-medium font-display">Broadcast original content across the entire network.</p>
              </header>

              <div className="glass-panel tech-border rounded-[2rem] p-10 space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase ml-1 font-mono">Broadcast Content</label>
                  <textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="What is the swarm saying today?"
                    className="w-full h-64 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none font-medium text-slate-200 font-display"
                  />
                  <div className="flex justify-end">
                    <span className={`text-xs font-black tracking-widest font-mono ${composerText.length > 280 ? "text-rose-500" : "text-slate-500"}`}>
                      {composerText.length} / 280
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end ml-1">
                    <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase font-mono">Deploying Agents ({composerAccounts.length})</label>
                    <button 
                      onClick={() => {
                        if (composerAccounts.length === accounts.length) {
                          setComposerAccounts([]);
                        } else {
                          setComposerAccounts(accounts.map(a => a.userId));
                        }
                      }}
                      className="text-[10px] font-black text-sky-400 hover:text-sky-300 uppercase tracking-widest font-mono transition-colors"
                    >
                      {composerAccounts.length === accounts.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {accounts.map((acc) => (
                      <button
                        key={acc.userId}
                        onClick={() => {
                          setComposerAccounts(prev => 
                            prev.includes(acc.userId) ? prev.filter(id => id !== acc.userId) : [...prev, acc.userId]
                          );
                        }}
                        className={`px-6 py-3 rounded-2xl border text-sm font-black transition-all font-mono tracking-tighter ${
                          composerAccounts.includes(acc.userId)
                            ? "bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/20"
                            : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700"
                        }`}
                      >
                        @{acc.screenName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase ml-1 font-mono">Media Payload</label>
                  <input
                    type="file"
                    onChange={(e) => setComposerMedia(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-400 file:mr-6 file:py-3 file:px-8 file:rounded-2xl file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 transition-all font-mono"
                  />
                </div>

                <button
                  onClick={handleBatchPost}
                  disabled={loading || composerAccounts.length === 0 || !composerText || composerText.length > 280}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-4 transition-all shadow-[0_0_40px_rgba(14,165,233,0.3)] disabled:opacity-50 text-lg font-display uppercase tracking-widest"
                >
                  <Send size={24} />
                  Initiate Swarm Broadcast
                </button>
              </div>
            </motion.div>
          )}
          {activeTab === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-10"
            >
              <header className="text-center">
                <h2 className="text-4xl font-black text-white tracking-tight mb-2 font-display uppercase">Deployment Protocol</h2>
                <p className="text-slate-400 font-medium font-display">Follow these steps to authorize your swarm agents.</p>
              </header>

              <div className="grid grid-cols-1 gap-6">
                <div className="glass-panel tech-border rounded-[2rem] p-10 space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20">
                        <span className="text-xl font-black text-sky-400 font-mono">01</span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-white font-display uppercase">Twitter Developer Portal</h3>
                        <p className="text-slate-400 leading-relaxed">
                          Navigate to <a href="https://developer.twitter.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">developer.twitter.com</a> and create a new Project and App.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20">
                        <span className="text-xl font-black text-sky-400 font-mono">02</span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-white font-display uppercase">Authentication Settings</h3>
                        <p className="text-slate-400 leading-relaxed">
                          Enable <span className="text-slate-200 font-bold">User authentication settings</span> with the following configuration:
                        </p>
                        <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2 font-medium">
                          <li>App Type: <span className="text-sky-400">Web App, Android, iOS</span></li>
                          <li>App Permissions: <span className="text-sky-400">Read and Write</span></li>
                          <li>Type of App: <span className="text-sky-400">OAuth 1.0a</span></li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20">
                        <span className="text-xl font-black text-sky-400 font-mono">03</span>
                      </div>
                      <div className="space-y-4 w-full">
                        <h3 className="text-xl font-black text-white font-display uppercase">Callback URLs</h3>
                        <p className="text-slate-400 leading-relaxed">Add these exact URLs to your Twitter App settings:</p>
                        <div className="space-y-3">
                          {[
                            "https://ais-dev-oiggqu5n3y5cgpq63tdny6-126453375965.europe-west2.run.app/api/auth/twitter/callback",
                            "https://ais-pre-oiggqu5n3y5cgpq63tdny6-126453375965.europe-west2.run.app/api/auth/twitter/callback"
                          ].map((url) => (
                            <div key={url} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between group">
                              <code className="text-xs text-sky-400 font-mono truncate mr-4">{url}</code>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(url);
                                  setStatus({ type: "success", message: "URL copied to clipboard" });
                                }}
                                className="p-2 text-slate-500 hover:text-sky-400 transition-colors"
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20">
                        <span className="text-xl font-black text-sky-400 font-mono">04</span>
                      </div>
                      <div className="space-y-4 w-full">
                        <h3 className="text-xl font-black text-white font-display uppercase">Environment Variables</h3>
                        <p className="text-slate-400 leading-relaxed">Add these secrets in the AI Studio panel:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 font-mono">Key</p>
                            <code className="text-sm text-emerald-400 font-mono">TWITTER_CONSUMER_KEY</code>
                          </div>
                          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                            <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 font-mono">Key</p>
                            <code className="text-sm text-emerald-400 font-mono">TWITTER_CONSUMER_SECRET</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-800">
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-6 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(14,165,233,0.4)]">
                        <Zap size={20} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-slate-300 font-display">
                        Once configured, go to the <span className="text-sky-400">Agent Network</span> tab to deploy your first agent.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
