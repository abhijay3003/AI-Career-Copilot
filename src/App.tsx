/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Upload,
  Briefcase,
  Target,
  Sparkles,
  Code,
  FileText,
  ArrowRight,
  Bot,
  User,
  RefreshCw,
  Play,
  Check,
  Download,
  LayoutDashboard,
  Award,
  BookOpen,
  MessageSquare,
  ChevronRight,
  ClipboardCheck,
  Terminal,
  Eraser,
  HelpCircle,
  Copy,
  Plus,
  Trash2,
  Lock,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResumeState,
  JobDescriptionState,
  MatchAnalysis,
  OptimizedBullet,
  InterviewQuestion,
  ChatMessage,
  PythonCodeFile
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"setup" | "match" | "optimize" | "interview" | "chat">("setup");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const [loading, setLoading] = useState<boolean>(false);
  const [session, setSession] = useState<{
    resume: ResumeState | null;
    jd: JobDescriptionState | null;
    matchAnalysis: MatchAnalysis | null;
    optimizedBullets: OptimizedBullet[] | null;
    interviewQuestions: InterviewQuestion[] | null;
  }>({
    resume: null,
    jd: null,
    matchAnalysis: null,
    optimizedBullets: null,
    interviewQuestions: null,
  });

  // Copied alert states
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Setup inputs
  const [resumeText, setResumeText] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [jdTitle, setJdTitle] = useState<string>("Software Engineer");
  const [jdCompany, setJdCompany] = useState<string>("Google");

  // Bullet optimization input
  const [inputBullets, setInputBullets] = useState<string[]>([
    "Responsible for managing application codebases and server setups.",
    "Worked with the backend development team to speed up database queries.",
    "Helped write technical documentation and resolved critical product bugs."
  ]);
  const [newBullet, setNewBullet] = useState<string>("");

  // Interview response states
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submittingAnswers, setSubmittingAnswers] = useState<Record<string, boolean>>({});

  // Chat window states
  const [chatScope, setChatScope] = useState<"resume" | "jd" | "joint">("joint");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userChatQuery, setUserChatQuery] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Global app status / connection feedback
  const [status, setStatus] = useState<{
    status: string;
    hasResume: boolean;
    hasJd: boolean;
    hasApiKey: boolean;
  } | null>(null);

  // Load backend session states and metrics on initialization
  const fetchSession = async () => {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        if (data.resume) {
          setResumeText(data.resume.text);
        }
        if (data.jd) {
          setJdText(data.jd.text);
          setJdTitle(data.jd.title);
          setJdCompany(data.jd.company);
        }
      }
    } catch (err) {
      console.error("Failed to connect to backend api state endpoint:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Query backend service health failed:", err);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchStatus();
  }, [activeTab]);

  // Upload handlers
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".txt")) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const textContent = reader.result as string;
          const response = await fetch("/api/upload-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: textContent,
              fileName: file.name
            }),
          });

          if (response.ok) {
            await fetchSession();
            await fetchStatus();
            showToast(`Successfully registered ${file.name}!`, "success");
          } else {
            const errData = await response.json();
            showToast("Extraction error: " + errData.error, "error");
          }
        } catch (err: any) {
          showToast("Failed to submit and parse document: " + err.message, "error");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
      return;
    }

    if (!file.type.match("application/pdf") && !file.name.endsWith(".pdf")) {
      showToast("Invalid format: please upload a `.pdf` or `.txt` file!", "error");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        const response = await fetch("/api/upload-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64String,
            fileName: file.name
          }),
        });

        if (response.ok) {
          await fetchSession();
          await fetchStatus();
          showToast(`Successfully parsed and registered ${file.name}!`, "success");
        } else {
          const errData = await response.json();
          showToast("Extraction error: " + errData.error, "error");
        }
      } catch (err: any) {
        showToast("Failed to submit and parse document: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTextResumeSubmit = async () => {
    if (!resumeText.trim()) {
      showToast("Resume statement cannot be empty!", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/upload-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: resumeText, fileName: "copied_resume.txt" }),
      });

      if (response.ok) {
        await fetchSession();
        await fetchStatus();
        showToast("Pasted resume registered successfully!", "success");
      } else {
        const err = await response.json();
        showToast("Registration failed: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("Operation failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleJdSubmit = async () => {
    if (!jdText.trim()) {
      showToast("Job parameters must be filled.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/upload-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: jdText,
          title: jdTitle,
          company: jdCompany
        }),
      });

      if (response.ok) {
        await fetchSession();
        await fetchStatus();
        showToast("Job specifications registered successfully!", "success");
      } else {
        const err = await response.json();
        showToast("Job Description submission failed: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("Connection failure: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Run ATS Analyzer
  const handleAnalyzeMatch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/match", {
        method: "POST"
      });
      if (response.ok) {
        const data = await response.json();
        setSession(prev => ({ ...prev, matchAnalysis: data }));
        showToast("ATS Fit analysis populated successfully!", "success");
      } else {
        const err = await response.json();
        showToast("Evaluation aborted: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("ATS processing error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Run Google XYZ Bullet points Optimizer
  const handleOptimizeBullets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/optimize-bullets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullets: inputBullets })
      });

      if (response.ok) {
        const data = await response.json();
        setSession(prev => ({ ...prev, optimizedBullets: data }));
        showToast("Bullet points optimization complete!", "success");
      } else {
        const err = await response.json();
        showToast("Optimization failed: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("Bullet evaluation error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Run customized questions builder
  const handleGenerateQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/interview", {
        method: "POST"
      });

      if (response.ok) {
        const data = await response.json();
        setSession(prev => ({ ...prev, interviewQuestions: data }));
        if (data.length > 0) {
          setActiveQuestionId(data[0].id);
        }
        showToast("Practice interview questions compiled!", "success");
      } else {
        const err = await response.json();
        showToast("Questions generator aborted: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("Interview coach builder error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Critique a student responses
  const handleSubmitMockAnswer = async (q: InterviewQuestion) => {
    const answer = userAnswers[q.id];
    if (!answer || !answer.trim()) {
      showToast("Please write something in your response first!", "info");
      return;
    }

    setSubmittingAnswers(prev => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          modelAnswer: q.modelAnswer,
          userAnswer: answer
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession(prev => {
          if (!prev.interviewQuestions) return prev;
          const updated = prev.interviewQuestions.map(item => {
            if (item.id === q.id) {
              return { ...item, userAnswer: answer, critique: data.critique };
            }
            return item;
          });
          return { ...prev, interviewQuestions: updated };
        });
        showToast("Coach feedback generated!", "success");
      } else {
        const error = await res.json();
        showToast("Critique error: " + error.error, "error");
      }
    } catch (err: any) {
      showToast("Answer evaluator error: " + err.message, "error");
    } finally {
      setSubmittingAnswers(prev => ({ ...prev, [q.id]: false }));
    }
  };

  // Run interactive Chatbot messages
  const handleSendChatMessage = async () => {
    if (!userChatQuery.trim()) return;

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now(),
      role: "user",
      text: userChatQuery,
      timestamp: new Date().toLocaleTimeString()
    };

    const thread = [...chatMessages, userMsg];
    setChatMessages(thread);
    setUserChatQuery("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: thread.map(m => ({ role: m.role, text: m.text })),
          scope: chatScope
        })
      });

      if (response.ok) {
        const data = await response.json();
        const modelMsg: ChatMessage = {
          id: "mdl_" + Date.now(),
          role: "model",
          text: data.text,
          timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, modelMsg]);
      } else {
        const err = await response.json();
        showToast("Chat error: " + err.error, "error");
      }
    } catch (err: any) {
      showToast("Interactive message fail: " + err.message, "error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearSession = async () => {
    try {
      const res = await fetch("/api/session/reset", { method: "POST" });
      if (res.ok) {
        setResumeText("");
        setJdText("");
        setSession({
          resume: null,
          jd: null,
          matchAnalysis: null,
          optimizedBullets: null,
          interviewQuestions: null,
        });
        setChatMessages([]);
        showToast("Session cleared successfully!", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Code Copy Clip helper
  const copyToClipboard = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500/30 flex flex-col">
      {/* Custom Toast Notification Component Overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`fixed top-5 right-5 z-[9999] max-w-sm p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              toast.type === "success" 
                ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-250 font-sans" 
                : toast.type === "error" 
                ? "bg-rose-950/90 border-rose-500/40 text-rose-250 font-sans" 
                : "bg-slate-900/95 border-slate-700/50 text-slate-200 font-sans"
            }`}
          >
            {toast.type === "success" && <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === "error" && <XCircle className="w-5 h-5 text-rose-450 shrink-0 mt-0.5" />}
            {toast.type === "info" && <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="text-xs font-bold leading-normal">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer text-xs leading-none"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Panel */}
      <header id="app-header" className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-50 shadow-md shadow-black/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Career<span className="text-indigo-400">AI</span>
              </h1>
            </div>
          </div>

          {/* Quick Stats Panel */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {status?.hasResume ? (
              <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Resume Loaded
              </span>
            ) : (
              <span className="text-[11px] bg-slate-805 text-slate-400 border border-slate-700 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> No Resume
              </span>
            )}

            {status?.hasJd ? (
              <span className="text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Target JD Active
              </span>
            ) : (
              <span className="text-[11px] bg-slate-805 text-slate-400 border border-slate-700 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> No Position Loaded
              </span>
            )}

            <button
              onClick={handleClearSession}
              title="Clear active workspace uploads"
              className="p-1.5 text-slate-400 hover:text-rose-450 hover:bg-rose-500/10 rounded-xl transition-all border border-slate-800 hover:border-rose-950 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Grid Wrapper */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Side Sidebar Controls (3 Grid span) */}
        <nav id="workspace-sidebar" className="lg:col-span-3 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-2 mb-1">Workspace Sections</div>
          
          <button
            onClick={() => setActiveTab("setup")}
            id="tab-setup-btn"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold tracking-normal transition-all duration-200 text-left border ${
              activeTab === "setup"
                ? "bg-indigo-650 text-white shadow-lg shadow-indigo-500/20 border-indigo-550"
                : "text-slate-300 bg-slate-900/40 border-slate-805 hover:bg-slate-800 hover:text-white"
            } cursor-pointer`}
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>1. Document Setup</span>
          </button>

          <button
            onClick={() => {
              if (!session.resume || !session.jd) {
                showToast("Please configure a Resume and Job Description under Tab 1 first!", "info");
                return;
              }
              setActiveTab("match");
            }}
            id="tab-match-btn"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold tracking-normal transition-all duration-200 text-left border ${
              activeTab === "match"
                ? "bg-indigo-650 text-white shadow-lg shadow-indigo-500/20 border-indigo-550"
                : "text-slate-300 bg-slate-900/40 border-slate-805 hover:bg-slate-800 hover:text-white"
            } ${(!session.resume || !session.jd) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className="flex items-center gap-3">
              <Target className="w-4 h-4 text-indigo-455" />
              <span>2. ATS Fit Matcher</span>
            </span>
            {session.matchAnalysis && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {session.matchAnalysis.score}%
              </span>
            )}
          </button>

          <button
            onClick={() => {
              if (!session.jd) {
                showToast("Please configure your Job Description profile under Tab 1 first!", "info");
                return;
              }
              setActiveTab("optimize");
            }}
            id="tab-optimize-btn"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold tracking-normal transition-all duration-200 text-left border ${
              activeTab === "optimize"
                ? "bg-indigo-650 text-white shadow-lg shadow-indigo-500/20 border-indigo-550"
                : "text-slate-300 bg-slate-900/40 border-slate-805 hover:bg-slate-800 hover:text-white"
            } ${!session.jd ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>3. Bullet Optimizer</span>
          </button>

          <button
            onClick={() => {
              if (!session.resume || !session.jd) {
                showToast("Please configure both Resume and Job Description under Tab 1 first!", "info");
                return;
              }
              setActiveTab("interview");
            }}
            id="tab-interview-btn"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold tracking-normal transition-all duration-200 text-left border ${
              activeTab === "interview"
                ? "bg-indigo-650 text-white shadow-lg shadow-indigo-500/20 border-indigo-550"
                : "text-slate-300 bg-slate-900/40 border-slate-805 hover:bg-slate-800 hover:text-white"
            } ${(!session.resume || !session.jd) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <BookOpen className="w-4 h-4 text-indigo-455" />
            <span>4. Interview Coach</span>
          </button>

          <button
            onClick={() => {
              if (!session.resume && !session.jd) {
                showToast("At least upload a document or job description to begin RAG query chat.", "info");
                return;
              }
              setActiveTab("chat");
            }}
            id="tab-chat-btn"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold tracking-normal transition-all duration-200 text-left border ${
              activeTab === "chat"
                ? "bg-indigo-650 text-white shadow-lg shadow-indigo-500/20 border-indigo-550"
                : "text-slate-300 bg-slate-900/40 border-slate-805 hover:bg-slate-800 hover:text-white"
            } ${(!session.resume && !session.jd) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>5. Document RAG Chat</span>
          </button>

          {/* Quick Help Card */}
          <div className="bg-gradient-to-br from-slate-905 via-slate-900 to-slate-800 border border-slate-800 rounded-3xl p-5 mt-6 hidden lg:block shadow-md">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
              <ClipboardCheck className="w-4 h-4 text-indigo-400" /> Quick workflow
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              Step 1: Save your PDF Resume and enter the JD text. Step 2: Query the RAG Matching Score. Step 3: Align bullets. Step 4: Try a sample interactive mock loop session!
            </p>
          </div>
        </nav>

        {/* Right Side Main Board (9 Grid span) */}
        <main id="workspace-viewport" className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col min-h-[550px] relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-center items-center gap-3 z-40 rounded-3xl">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-800 border-t-indigo-500 animate-pulse"></div>
              <p className="text-xs font-bold text-indigo-200">Loading...</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* TAB 1: DOCUMENT SETUP AND UPLOAD */}
            {activeTab === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6 flex flex-col justify-between h-full"
              >
                <div>
                  <div className="border-b border-slate-800 pb-4 mb-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-400" /> Complete Setup Configuration
                    </h2>
                    <p className="text-xs text-slate-400">Provide candidate document profiles and specifications target parameters for matching analysis.</p>
                  </div>

                  {status && (
                    <div className="bg-indigo-950/25 border border-indigo-500/20 rounded-3xl p-5 mb-6 text-xs flex gap-4 items-start shadow-lg">
                      <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-2xl">
                        <Sparkles className="w-5 h-5 shrink-0" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-indigo-300">Local Ollama AI Integration</h4>
                        <p className="text-slate-300 leading-relaxed font-normal font-medium">
                          Your Career AI Assistant is configured for keyless, private, and fully offline executions using Ollama locally!
                        </p>
                        <p className="text-slate-400 leading-relaxed font-normal">
                          Connection host: <span className="font-mono text-indigo-455 font-bold">{(status as any)?.ollamaBaseUrl || "http://localhost:11434"}</span> • Current Model: <span className="font-mono text-slate-200 font-bold">{(status as any)?.ollamaModel || "llama3"}</span>. To start the local LLM server on your machine, simply execute: <code className="bg-slate-950 text-indigo-300 font-bold px-1.5 py-0.5 rounded font-mono">ollama run {(status as any)?.ollamaModel || "llama3"}</code>.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Resume Card section */}
                    <div className="bg-slate-900/50 border border-slate-800 p-5 md:p-6 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-400" /> Candidate Resume
                        </label>
                        {session.resume ? (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-md font-semibold font-mono tracking-wider">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-md font-semibold font-mono">
                            EMPTY
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Drag and drop mock or PDF/TXT Upload selector input */}
                        <div className="border border-dashed border-slate-700 hover:border-indigo-500 transition-colors bg-slate-950/40 hover:bg-slate-950/70 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-2 cursor-pointer relative">
                          <input
                            type="file"
                            accept=".pdf,.txt"
                            onChange={handlePdfUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="bg-indigo-550/10 text-indigo-400 p-3 rounded-2xl mb-1">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-100">Upload Resume (.pdf, .txt)</span>
                          <span className="text-[10px] text-slate-400 font-normal">Pure client-to-server extraction indexing</span>
                        </div>

                        {session.resume && (
                          <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex items-center justify-between text-xs text-slate-300">
                            <span className="font-semibold text-slate-200 truncate max-w-[180px]">{session.resume.fileName}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              Parsed {Math.round(session.resume.text.length / 100) / 10}k chars
                            </span>
                          </div>
                        )}

                        <div className="text-[9px] text-slate-500 text-center font-bold tracking-widest uppercase py-1">OR PASTE TEXT DIRECTLY BELOW</div>

                        <textarea
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                          placeholder="Paste plaintext resume experience bullets here..."
                          className="w-full h-36 bg-slate-950 text-slate-100 border border-slate-700 rounded-2xl p-3.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-normal placeholder:text-slate-600 transition-all font-mono"
                        />
                        
                        <button
                          onClick={handleTextResumeSubmit}
                          className="w-full bg-slate-800 text-slate-200 text-xs py-2.5 rounded-xl font-bold border border-slate-700 hover:bg-slate-750 hover:text-white transition-colors cursor-pointer"
                        >
                          Register Pasted Text
                        </button>
                      </div>
                    </div>

                    {/* Job Description panel */}
                    <div className="bg-slate-900/50 border border-slate-800 p-5 md:p-6 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-indigo-400" /> Target Job Description
                        </label>
                        {session.jd ? (
                          <span className="text-[10px] bg-indigo-500/15 text-indigo-455 border border-indigo-550/25 px-2.5 py-0.5 rounded-md font-semibold font-mono tracking-wider">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-md font-semibold font-mono">
                            EMPTY
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Title</span>
                            <input
                              type="text"
                              value={jdTitle}
                              onChange={(e) => setJdTitle(e.target.value)}
                              placeholder="e.g. Senior Backend Engineer"
                              className="w-full bg-slate-950 text-slate-100 border border-slate-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-normal placeholder:text-slate-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider block mb-1">Company</span>
                            <input
                              type="text"
                              value={jdCompany}
                              onChange={(e) => setJdCompany(e.target.value)}
                              placeholder="e.g. Netflix"
                              className="w-full bg-slate-950 text-slate-105 border border-slate-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-normal placeholder:text-slate-600"
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Scope requirements details</span>
                          <textarea
                            value={jdText}
                            onChange={(e) => setJdText(e.target.value)}
                            placeholder="Enter the full target role requirements list, technologies, preferred seniority..."
                            className="w-full h-[142px] bg-slate-950 text-slate-100 border border-slate-700 rounded-2xl p-3.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-normal placeholder:text-slate-600 font-mono"
                          />
                        </div>

                        <button
                          onClick={handleJdSubmit}
                          className="w-full bg-indigo-600 text-white text-xs py-2.5 rounded-xl font-bold hover:bg-indigo-500 hover:shadow-lg shadow-indigo-600/10 transition-colors cursor-pointer"
                        >
                          Register Target Specifications
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800 mt-4 flex justify-end">
                  <button
                    disabled={!session.resume || !session.jd}
                    onClick={() => setActiveTab("match")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-xl hover:shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Match Analysis</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 2: ATS FIT MATCHER */}
            {activeTab === "match" && (
              <motion.div
                key="match"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4 flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-400" /> ATS Alignment Dashboard
                    </h2>
                    <p className="text-xs text-slate-400">Algorithmic scoring and semantic match rating of technical attributes.</p>
                  </div>

                  <button
                    onClick={handleAnalyzeMatch}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin-hover" />
                    <span>Run Match scan</span>
                  </button>
                </div>

                {!session.matchAnalysis ? (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="bg-indigo-500/10 text-indigo-400 p-4 rounded-full">
                      <Target className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h3 className="text-sm font-bold text-white">Scan Required</h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal">
                        Please initiate the matching script to analyze your resume text dynamically against the Registered Job parameters.
                      </p>
                    </div>
                    <button
                      onClick={handleAnalyzeMatch}
                      className="bg-indigo-600 text-white text-xs py-2.5 px-6 rounded-xl font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-605/15 cursor-pointer"
                    >
                      Process Document Scoring Analysis
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top Scoring metrics visualization */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                      {/* Radial Progress Gauge (4 grid columns) */}
                      <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center md:col-span-4 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-505"></div>
                        <span className="text-[10px] font-mono font-bold uppercase text-slate-450 tracking-wider mb-4">Overall ATS Score</span>
                        
                        <div className="relative flex items-center justify-center">
                          {/* Circle Graphic background */}
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="54"
                              stroke="#1e293b"
                              strokeWidth="8"
                              fill="transparent"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="54"
                              stroke={session.matchAnalysis.score >= 75 ? "#10b981" : (session.matchAnalysis.score >= 50 ? "#f59e0b" : "#ef4444")}
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 54}
                              strokeDashoffset={2 * Math.PI * 54 * (1 - session.matchAnalysis.score / 100)}
                              className="transition-all duration-1000 ease-out"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <span className="text-3xl font-black text-white">{session.matchAnalysis.score}</span>
                            <span className="text-[10px] text-slate-450 font-bold block">/ 100</span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold py-1 px-3.5 rounded-full mt-4 border ${
                          session.matchAnalysis.score >= 75 
                            ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/20" 
                            : (session.matchAnalysis.score >= 50 ? "bg-amber-500/10 text-amber-450 border-amber-500/20" : "bg-rose-500/10 text-rose-450 border-rose-500/20")
                        }`}>
                          {session.matchAnalysis.score >= 75 ? "Strong Match Alignment" : (session.matchAnalysis.score >= 50 ? "Moderate Alignment" : "Requires Re-optimization")}
                        </span>
                      </div>

                      {/* Side-by-side Skills chips matching checklist (8 grid columns) */}
                      <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl md:col-span-8 flex flex-col justify-between space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-505"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-1.5 mb-3">
                              <span className="w-2 h-2 rounded-full bg-emerald-450"></span>
                              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">Matching Core Skills</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {session.matchAnalysis.matchingSkills.map((s: string, idx: number) => (
                                <span key={idx} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md font-bold font-mono uppercase">
                                  {s}
                                </span>
                              ))}
                              {session.matchAnalysis.matchingSkills.length === 0 && (
                                <span className="text-xs text-slate-500 italic font-mono">No skills overlap extracted.</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 mb-3">
                              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">Identified Gaps (Missing)</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {session.matchAnalysis.missingSkills.map((s: string, idx: number) => (
                                <span key={idx} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md font-bold font-mono uppercase animate-pulse">
                                  {s}
                                </span>
                              ))}
                              {session.matchAnalysis.missingSkills.length === 0 && (
                                <span className="text-xs text-emerald-400 font-semibold font-mono flex items-center gap-1">🚀 Match complete!</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-800 pt-3">
                          <p className="text-[11px] text-slate-500 italic">These classifications were analyzed semantically based on job specifications.</p>
                        </div>
                      </div>
                    </div>

                    {/* Local custom structured markdown report and lists improvements advice */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Suggestions and Advice List (5 columns) */}
                      <div className="bg-slate-900/40 border border-slate-800 p-5 md:p-6 rounded-3xl lg:col-span-12 xl:col-span-5 space-y-4 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-505"></div>
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-indigo-400" /> Actionable Advice
                        </span>
                        <ul className="space-y-3">
                          {session.matchAnalysis.suggestions.map((item: string, idx: number) => (
                            <li key={idx} className="text-xs text-slate-300 flex items-start gap-3 leading-relaxed">
                              <span className="bg-indigo-500/15 text-indigo-300 font-extrabold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Structured parsed report (7 columns) */}
                      <div className="bg-slate-900/40 border border-slate-800 p-5 md:p-6 rounded-3xl lg:col-span-12 xl:col-span-7 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-550"></div>
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider mb-4">
                          <Terminal className="w-4 h-4 text-indigo-400" /> Executive Match Breakdown
                        </span>
                        
                        <div className="bg-slate-950 text-indigo-200/90 p-4 rounded-2xl font-mono text-[11px] h-64 overflow-y-auto leading-relaxed border border-slate-800 shadow-inner [scrollbar-width:thin]">
                          <pre className="whitespace-pre-wrap text-emerald-400 font-mono text-[11px] font-normal">{session.matchAnalysis.atsReport}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: GOOGLE XYZ BULLET RESUME OPTIMIZER */}
            {activeTab === "optimize" && (
              <motion.div
                key="optimize"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4 flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" /> Google XYZ Resume Bullet Optimizer
                    </h2>
                    <p className="text-xs text-slate-400">Re-structure accomplishments to conform to the: Accomplished [X], measured by [Y], by doing [Z] template.</p>
                  </div>

                  <button
                    onClick={handleOptimizeBullets}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Optimize Bullets</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Manage bullets list input */}
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl lg:col-span-12 xl:col-span-5 space-y-4 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block font-sans">Current Accomplishments statements</span>
                    
                    <div className="space-y-3 max-h-72 overflow-y-auto [scrollbar-width:thin]">
                      {inputBullets.map((b, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex justify-between gap-3 items-start relative hover:bg-slate-900 transition-colors">
                          <div className="text-xs text-slate-300 leading-relaxed font-normal flex-1">
                            {b}
                          </div>
                          <button
                            onClick={() => setInputBullets(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:text-rose-450 text-slate-500 rounded-lg translate-y-[-2px] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {inputBullets.length === 0 && (
                        <div className="text-xs italic text-slate-505 text-center py-6 font-mono">No bullet point arguments loaded. Paste some below!</div>
                      )}
                    </div>

                    {/* Add Bullet points forms */}
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <textarea
                        value={newBullet}
                        onChange={(e) => setNewBullet(e.target.value)}
                        placeholder="Add achievements description (e.g., 'Helped scale API setups in the backend')"
                        className="w-full bg-slate-950 border border-slate-705 rounded-2xl p-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 outline-none font-sans"
                        rows={2}
                      />
                      <button
                        onClick={() => {
                          if (!newBullet.trim()) return;
                          setInputBullets(prev => [...prev, newBullet]);
                          setNewBullet("");
                        }}
                        className="w-full bg-slate-800 text-slate-205 text-xs py-2.5 rounded-xl font-bold border border-slate-700 hover:bg-slate-750 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Statement
                      </button>
                    </div>
                  </div>
                  {/* Right Column: Optimization results split view */}
                  <div className="lg:col-span-12 xl:col-span-7 bg-transparent space-y-4">
                    {!session.optimizedBullets ? (
                      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4 h-full min-h-[300px] relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                        <div className="bg-indigo-500/10 text-indigo-400 p-4 rounded-full">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-200">Optimization Queue Empty</h4>
                        <p className="text-[11px] text-slate-450 max-w-sm font-normal">
                          Hit the **Optimize Bullets** button to process existing sentences into Google-grade high-impact STAR frameworks using the job rules.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {session.optimizedBullets.map((obj, idx) => (
                          <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 shadow-md hover:border-slate-700 transition-all space-y-4 relative">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-500"></div>
                            {/* Original vs Optimized */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-xl">
                                <span className="text-[9px] font-mono font-bold text-rose-450 uppercase tracking-widest block mb-1">Before (Original)</span>
                                <p className="text-xs text-slate-400 leading-normal font-normal italic">{obj.original}</p>
                              </div>

                              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl">
                                <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-1">After (Google XYZ Model)</span>
                                <p className="text-xs text-slate-100 leading-normal font-bold">{obj.optimized}</p>
                              </div>
                            </div>

                            {/* Ratings metrics & dynamic justification explanations */}
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Alignment & Strengths Justification</span>
                                <p className="text-slate-300 font-normal text-[11px] leading-relaxed">{obj.explanation}</p>
                              </div>

                              {/* Simple Impact level score badge */}
                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                <div className="text-right">
                                  <span className="text-[9px] font-semibold text-slate-500 block uppercase">Impact Score</span>
                                  <span className="font-bold text-slate-200 text-[11px] tracking-wide">{obj.impactScoreBefore} → {obj.impactScoreAfter} / 5</span>
                                </div>
                                <div className="flex select-none">
                                  {[...Array(5)].map((_, i) => (
                                    <span key={i} className={`text-sm ${i < obj.impactScoreAfter ? "text-amber-400 animate-pulse" : "text-slate-850"}`}>★</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: INTERACTIVE INTERVIEW COACH */}
            {activeTab === "interview" && (
              <motion.div
                key="interview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="border-b border-slate-800 pb-4 flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-400" /> Interactive AI Mock Coach
                    </h2>
                    <p className="text-xs text-slate-400">Practice questions custom curated from target JD specifications and candidate records, with live evaluations.</p>
                  </div>

                  <button
                    onClick={handleGenerateQuestions}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-650/15 cursor-pointer"
                  >
                    Generate Coach Scenarios
                  </button>
                </div>

                {!session.interviewQuestions ? (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="bg-indigo-500/10 text-indigo-400 p-4 rounded-full">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-white">Mock Sandbox Offline</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto font-normal">
                        Hit generate questions to produce 3 curated technical, HR, and behavioral scenario questions based on your profile details.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateQuestions}
                      className="bg-indigo-600 text-white text-xs font-bold py-2.5 px-6 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/15 cursor-pointer"
                    >
                      Generate Mock Scenarios Loop
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Questions selector (5 columns) */}
                    <div className="lg:col-span-12 xl:col-span-5 space-y-3">
                      <span className="text-xs font-bold text-slate-205 uppercase tracking-wider block">Question Loop Selection</span>
                      
                      <div className="space-y-3">
                        {session.interviewQuestions.map((q) => {
                          const isSelected = activeQuestionId === q.id;
                          return (
                            <button
                              key={q.id}
                              onClick={() => setActiveQuestionId(q.id)}
                              className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 relative cursor-pointer ${
                                isSelected
                                  ? "bg-slate-950 border-indigo-505 text-white shadow-lg shadow-black/30"
                                  : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-850"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  isSelected 
                                    ? "bg-indigo-500/20 text-indigo-300" 
                                    : "bg-slate-800 text-slate-400"
                                }`}>
                                  {q.type} Question
                                </span>
                                {q.critique && (
                                  <span className="text-emerald-400 flex items-center gap-1 text-[9px] font-bold font-mono">
                                    <Check className="w-3 h-3" /> Reviewed
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold leading-normal line-clamp-2">{q.question}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active work pane (STAR Answer sheet & critique breakdown) (7 columns) */}
                    <div className="lg:col-span-12 xl:col-span-7 bg-slate-900/40 border border-slate-800 p-5 rounded-3xl shadow-md space-y-5 relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                      {(() => {
                        const activeQ = session.interviewQuestions.find(q => q.id === activeQuestionId);
                        if (!activeQ) return <div className="text-xs text-slate-500 italic text-center py-10 font-mono">Select a question to practice.</div>;

                        return (
                          <div className="space-y-4">
                            {/* Question description banner */}
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mb-1">Scenario Question</span>
                              <p className="text-xs font-bold leading-relaxed text-indigo-200">{activeQ.question}</p>
                            </div>

                            {/* Write answer box */}
                            {!activeQ.critique ? (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between mb-1.5 font-sans">
                                    <span>Your Mock Response Script</span>
                                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">STAR MODEL ACCORD</span>
                                  </label>
                                  <textarea
                                    value={userAnswers[activeQ.id] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setUserAnswers(prev => ({ ...prev, [activeQ.id]: val }));
                                    }}
                                    placeholder="Type your mock response here. Focus on metrics achievements, clear actions, and technology structures using STAR Framework..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed font-sans"
                                    rows={5}
                                  />
                                </div>

                                <button
                                  disabled={submittingAnswers[activeQ.id]}
                                  onClick={() => handleSubmitMockAnswer(activeQ)}
                                  className="w-full bg-indigo-600 text-white text-xs py-2.5 rounded-xl font-bold hover:bg-indigo-500 hover:shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  {submittingAnswers[activeQ.id] ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Evaluating with Career Coach...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5" />
                                      <span>Submit Response for AI Review</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              // Critique and suggestions active panel
                              <div className="space-y-4">
                                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-inner bg-slate-950">
                                  <div className="bg-slate-900 border-b border-slate-850 px-4 py-2 flex items-center gap-2">
                                    <div className="bg-indigo-500 rounded-full h-2 w-2 animate-pulse"></div>
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Coaching Critique Report</span>
                                  </div>
                                  <div className="p-4 text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
                                    {activeQ.critique}
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    setSession(prev => {
                                      if (!prev.interviewQuestions) return prev;
                                      return {
                                        ...prev,
                                        interviewQuestions: prev.interviewQuestions.map(item => {
                                          if (item.id === activeQ.id) {
                                            return { ...item, critique: undefined, userAnswer: undefined };
                                          }
                                          return item;
                                        })
                                      };
                                    });
                                  }}
                                  className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eraser className="w-3.5 h-3.5 text-indigo-400" /> Close Critique and Retry
                                </button>
                              </div>
                            )}

                            {/* Suggested Answer rubric accordion details help */}
                            <div className="pt-2 border-t border-slate-800">
                              <details className="group">
                                <summary className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer flex items-center gap-1.5 list-none select-none font-mono tracking-wider uppercase">
                                  <span className="transition-transform group-open:rotate-90">▶</span>
                                  <span>View Model Answer Checklist</span>
                                </summary>
                                <div className="mt-2 text-[11px] text-slate-400 leading-relaxed bg-slate-950 border border-slate-850 p-3.5 rounded-xl font-normal">
                                  {activeQ.modelAnswer}
                                </div>
                              </details>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 5: DOCUMENT RAG CHAT */}
            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 flex flex-col h-full flex-1"
              >
                <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                       <MessageSquare className="w-5 h-5 text-indigo-400" /> Interactive Document Chatbot
                    </h2>
                    <p className="text-xs text-slate-400">Query or discuss formatting and matching details inside your uploaded documents context.</p>
                  </div>

                  {/* Toggle Selector scope chat */}
                  <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-805 select-none self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setChatScope("resume")}
                      disabled={!session.resume}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-30 cursor-pointer ${
                        chatScope === "resume" ? "bg-indigo-600 text-white shadow-md" : "text-slate-450 hover:text-white"
                      }`}
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => setChatScope("jd")}
                      disabled={!session.jd}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-30 cursor-pointer ${
                        chatScope === "jd" ? "bg-indigo-600 text-white shadow-md" : "text-slate-455 hover:text-white"
                      }`}
                    >
                      JD Specs
                    </button>
                    <button
                      onClick={() => setChatScope("joint")}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        chatScope === "joint" ? "bg-indigo-600 text-white shadow-md" : "text-slate-450 hover:text-white"
                      }`}
                    >
                      Joint
                    </button>
                  </div>
                </div>

                {/* Messages pane content area */}
                <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-5 h-96 overflow-y-auto space-y-4 flex flex-col [scrollbar-width:thin]">
                  {chatMessages.length === 0 && (
                    <div className="m-auto text-center space-y-4 p-6 max-w-sm">
                      <div className="bg-indigo-500/10 text-indigo-400 p-4 rounded-full inline-block animate-pulse">
                        <Bot className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-200">RAG Conversation Active</h4>
                      <p className="text-[11px] text-slate-450 leading-relaxed font-normal">
                        Ask questions like: "What technical gaps should I address?", "Optimize mine projects descriptions matching this position" or "Summarize the key tasks".
                      </p>
                    </div>
                  )}

                  {chatMessages.map((msg) => {
                    const isModel = msg.role === "model";
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[80%] flex flex-col gap-1.5 rounded-2xl p-4 text-xs leading-relaxed border ${
                          isModel
                            ? "bg-slate-950 text-slate-205 border-slate-850 self-start rounded-tl-none"
                            : "bg-indigo-600/90 text-white border-indigo-550/10 self-end rounded-tr-none shadow-md shadow-indigo-600/5"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold opacity-75">
                          {isModel ? (
                            <>
                              <Bot className="w-3.5 h-3.5 text-indigo-450" />
                              <span className="text-indigo-300">Career Advisor AI</span>
                            </>
                          ) : (
                            <>
                              <User className="w-3.5 h-3.5 text-slate-300" />
                              <span className="text-slate-200">Candidate</span>
                            </>
                          )}
                          <span className="mx-1">•</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <p className="whitespace-pre-wrap font-normal leading-relaxed">{msg.text}</p>
                      </div>
                    );
                  })}

                  {chatLoading && (
                    <div className="bg-slate-950 border border-slate-850 text-slate-300 rounded-2xl rounded-tl-none p-4 text-xs self-start max-w-[80%] flex items-center gap-2 font-mono">
                      <Bot className="w-4 h-4 text-indigo-400 animate-spin" />
                      <span className="text-[11px]">Retrieving context and drafting response...</span>
                    </div>
                  )}
                </div>

                {/* Input prompt query footer */}
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={userChatQuery}
                    onChange={(e) => setUserChatQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    placeholder={`Ask a question within the context of the '${chatScope}' scope...`}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 focus:outline-none font-sans"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    className="bg-indigo-650 hover:bg-indigo-600 text-white px-5 rounded-2xl font-bold transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-650/10"
                  >
                    <span>Send Query</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}


          </AnimatePresence>
        </main>
      </div>

      {/* Footer Area */}
      <footer className="bg-transparent border-t border-slate-900 mt-12 py-8 px-6 text-center text-xs text-slate-500 font-normal">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Career AI Assistant. Keyless server-side integration powered by private local Ollama models.</p>
          <div className="flex gap-4">
            <a href="#app-header" className="hover:text-slate-300 transition-colors">Go to top</a>
            <span>•</span>
            <span className="text-slate-600">Secure Sandboxed Dev Platform Execution</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
