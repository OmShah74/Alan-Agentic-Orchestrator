"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChatMessage, WSMessage, DelegationStep, ApprovalData,
  createChatWebSocket, fetchMessages, cancelTask
} from "@/lib/api";
import ApprovalModal from "@/components/ApprovalModal";
import MarkdownView from "@/components/MarkdownView";

interface ChatAreaProps {
  conversationId: string | null;
  onTitleUpdate?: (title: string) => void;
  onStepsUpdate?: (steps: DelegationStep[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

// ─── Agent Style Map ────────────────────────────────────────────
const AGENT_STYLES: Record<string, { icon: string; color: string; bg: string; label: string; gradient: string }> = {
  command_executor: { icon: "⌨️", color: "text-blue-400", bg: "bg-blue-500/10", label: "Command Executor", gradient: "from-blue-600 to-blue-400" },
  file_operator:    { icon: "📁", color: "text-green-400", bg: "bg-green-500/10", label: "File Operator",    gradient: "from-green-600 to-green-400" },
  code_executor:    { icon: "💻", color: "text-purple-400", bg: "bg-purple-500/10", label: "Code Executor",  gradient: "from-purple-600 to-purple-400" },
  tool_executor:    { icon: "🔧", color: "text-orange-400", bg: "bg-orange-500/10", label: "Tool Executor",  gradient: "from-orange-600 to-orange-400" },
  local_executor:   { icon: "🖥️", color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Local Executor",    gradient: "from-cyan-600 to-cyan-400" },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string; icon: string }> = {
  pending:  { dot: "bg-gray-400",    label: "Queued",    badge: "bg-gray-500/15 text-gray-400",   icon: "⏳" },
  running:  { dot: "bg-blue-400 pulse-dot", label: "Running",   badge: "bg-blue-500/15 text-blue-400",   icon: "⚙️" },
  success:  { dot: "bg-green-400",   label: "Complete",  badge: "bg-green-500/15 text-green-400",  icon: "✅" },
  error:    { dot: "bg-red-400",     label: "Failed",    badge: "bg-red-500/15 text-red-400",      icon: "❌" },
  blocked:  { dot: "bg-yellow-400 pulse-dot", label: "Blocked", badge: "bg-yellow-500/15 text-yellow-400", icon: "🔒" },
};

// ─── Step Card with Full Details ────────────────────────────────
function StepCard({ step, isLast }: { step: DelegationStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(isLast);
  const agent = AGENT_STYLES[step.agent] || { icon: "🤖", color: "text-gray-400", bg: "bg-gray-500/10", label: step.agent, gradient: "from-gray-600 to-gray-400" };
  const status = STATUS_CONFIG[step.status] || STATUS_CONFIG.running;

  return (
    <div className="fade-in ml-9 mb-2">
      <div className="rounded-xl border border-[var(--border-color)] overflow-hidden"
        style={{ background: "var(--bg-card)" }}>

        {/* Header — always visible */}
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors group">
          
          {/* Agent icon with gradient ring */}
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${agent.bg} border border-transparent group-hover:border-[var(--accent-purple)]/30 transition-colors`}>
            {agent.icon}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[12px] font-semibold ${agent.color}`}>{agent.label}</span>
              <span className="text-[9px] text-[var(--text-dim)] font-mono">Step #{step.stepNumber}</span>
            </div>
            {step.action && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">→</span>
                <code className="text-[10px] text-[var(--accent-purple-light)] font-mono">{step.action}</code>
              </div>
            )}
          </div>
          
          {/* Status badge */}
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap ${status.badge} flex items-center gap-1`}>
            <span>{status.icon}</span>
            {status.label}
          </span>
          
          {/* Expand chevron */}
          <svg className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expandable body with max-height transition */}
        {expanded && (
          <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-color)] pt-2 fade-in">
            
            {/* Parameters */}
            {step.payload?.parameters && Object.keys(step.payload.parameters).length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px]">📋</span>
                  <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider">Parameters</p>
                </div>
                <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                  {Object.entries(step.payload.parameters).map(([key, val]) => (
                    <div key={key} className="flex border-b border-[var(--border-color)] last:border-0">
                      <span className="text-[10px] text-[var(--accent-purple-light)] font-mono px-2 py-1.5 bg-[var(--bg-tertiary)] w-24 flex-shrink-0 break-all">{key}</span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono px-2 py-1.5 break-all whitespace-pre-wrap flex-1 min-w-0">
                        {typeof val === "string" ? (val.length > 200 ? val.substring(0, 200) + "..." : val) : JSON.stringify(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STDOUT */}
            {step.stdout && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px]">📤</span>
                  <p className="text-[9px] font-bold text-green-500/70 uppercase tracking-wider">Output</p>
                </div>
                <pre className="text-[10px] text-green-300 bg-[var(--bg-primary)] rounded-lg p-2.5 overflow-x-auto overflow-y-auto max-h-40 font-mono whitespace-pre-wrap break-words border border-green-500/10">
                  {step.stdout}
                </pre>
              </div>
            )}

            {/* STDERR */}
            {step.stderr && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px]">⚠️</span>
                  <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-wider">Error</p>
                </div>
                <pre className="text-[10px] text-red-300 bg-[var(--bg-primary)] rounded-lg p-2.5 overflow-x-auto overflow-y-auto max-h-40 font-mono whitespace-pre-wrap break-words border border-red-500/10">
                  {step.stderr}
                </pre>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex justify-end">
              <span className="text-[8px] text-[var(--text-dim)]">
                {step.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Execution Progress Bar ─────────────────────────────────────
function ExecutionProgress({ steps, isLoading, iteration, currentAgent, onStop }: {
  steps: DelegationStep[]; isLoading: boolean; iteration: number; currentAgent: string | null; onStop: () => void;
}) {
  if (!isLoading && steps.length === 0) return null;

  const completed = steps.filter(s => s.status === "success").length;
  const errored = steps.filter(s => s.status === "error").length;
  const running = steps.filter(s => s.status === "running").length;
  const blocked = steps.filter(s => s.status === "blocked").length;
  const total = steps.length;

  const progressPercent = total > 0 ? Math.round((completed / Math.max(total, 1)) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl mb-2 px-4">
      <div className="glass rounded-xl overflow-hidden">
        {/* Progress bar */}
        {isLoading && (
          <div className="h-0.5 bg-[var(--bg-tertiary)]">
            <div className="h-full bg-[var(--accent-purple)] transition-all duration-300 shimmer"
              style={{ width: `${Math.max(progressPercent, 5)}%` }} />
          </div>
        )}
        
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px]">
            {isLoading && (
              <span className="flex items-center gap-1 text-[var(--accent-purple-light)]">
                <svg className="w-3 h-3 spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {currentAgent === "alan" ? `Planning (iter ${iteration})` : `Executing via ${currentAgent}`}
              </span>
            )}
            {!isLoading && total > 0 && (
              <span className="text-[var(--text-muted)] font-medium">Execution Complete</span>
            )}
            {running > 0 && <span className="flex items-center gap-1 text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />{running} active</span>}
            {completed > 0 && <span className="flex items-center gap-1 text-green-400">✅ {completed}</span>}
            {errored > 0 && <span className="flex items-center gap-1 text-red-400">❌ {errored}</span>}
            {blocked > 0 && <span className="flex items-center gap-1 text-yellow-400">🔒 {blocked}</span>}
          </div>
          {isLoading && (
            <button onClick={onStop}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white transition-all hover:opacity-80 hover:scale-105 active:scale-95"
              style={{ background: "var(--gradient-red)" }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop Execution
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Thinking Indicator ─────────────────────────────────────────
function ThinkingIndicator({ currentAgent, iteration }: { currentAgent: string; iteration: number }) {
  return (
    <div className="flex items-start gap-2 fade-in">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
        style={{ background: "var(--gradient-purple)" }}>
        <svg className="w-4 h-4 spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div className="glass rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--text-secondary)]">
            {currentAgent === "alan"
              ? `Alan is planning (iteration ${iteration})`
              : `Delegating to ${currentAgent}`}
          </span>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)] typing-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)] typing-dot" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-purple)] typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const [showCopy, setShowCopy] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(msg.content);
    setShowCopy(true);
    setTimeout(() => setShowCopy(false), 1500);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} fade-in group`}>
      {/* Alan avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 text-white text-[10px] font-bold shadow-lg"
          style={{ background: "var(--gradient-purple)" }}>A</div>
      )}

      <div className="max-w-[80%] relative">
        <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
          isUser
            ? "text-white rounded-br-sm"
            : "glass rounded-bl-sm"
        }`} style={isUser ? { background: "var(--accent-purple)" } : undefined}>
          
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <MarkdownView content={msg.content} />
          )}
        </div>

        {/* Copy button */}
        {!isUser && (
          <button onClick={copyContent}
            className="absolute -bottom-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-md text-[9px] text-[var(--text-muted)] hover:text-[var(--accent-purple-light)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]">
            {showCopy ? "Copied!" : "Copy"}
          </button>
        )}

        {/* Timestamp */}
        <p className={`text-[8px] text-[var(--text-dim)] mt-1 ${isUser ? "text-right" : "text-left ml-1"}`}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center ml-2 mt-0.5 flex-shrink-0 text-white text-[10px] font-bold"
          style={{ background: "var(--accent-purple-dark)" }}>U</div>
      )}
    </div>
  );
}

// ─── Main ChatArea ──────────────────────────────────────────────
export default function ChatArea({ conversationId, onTitleUpdate, onStepsUpdate, onLoadingChange }: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [steps, setSteps] = useState<DelegationStep[]>([]);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [iteration, setIteration] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Propagate steps and loading to parent
  useEffect(() => { onStepsUpdate?.(steps); }, [steps, onStepsUpdate]);
  useEffect(() => { onLoadingChange?.(isLoading); }, [isLoading, onLoadingChange]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, steps, isLoading, scrollToBottom]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) { setMessages([]); setSteps([]); return; }
    loadMessages(conversationId);
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [conversationId]);

  async function loadMessages(convId: string) {
    const msgs = await fetchMessages(convId);
    setMessages(msgs);
    scrollToBottom();
  }

  function connectWS(convId: string) {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const ws = createChatWebSocket(convId,
      (msg) => handleWSMessage(msg),
      () => { setIsLoading(false); },
      () => { setIsLoading(false); }
    );
    wsRef.current = ws;
    return ws;
  }

  function handleWSMessage(msg: WSMessage) {
    switch (msg.type) {
      case "ack":
        break;

      case "status":
        setCurrentAgent(msg.agent || "alan");
        setIteration(msg.iteration || 0);
        break;

      case "delegation":
        setSteps(prev => [...prev, {
          agent: msg.agent || "",
          action: msg.action || "",
          stepNumber: msg.step_number || 0,
          stepId: msg.step_id || "",
          status: "running",
          payload: msg.payload as DelegationStep["payload"],
          timestamp: new Date(),
        }]);
        setCurrentAgent(msg.agent || null);
        break;

      case "step_result":
        setSteps(prev => prev.map(s =>
          s.stepNumber === msg.step_number
            ? { ...s, status: (msg.status === "success" ? "success" : "error") as DelegationStep["status"], stdout: msg.stdout, stderr: msg.stderr }
            : s
        ));
        break;

      case "approval_required":
        setApprovalData({
          agent: msg.agent || "", stepId: msg.step_id || "",
          taskId: msg.task_id || "", command: msg.command || "",
          message: msg.message || "",
        });
        setSteps(prev => prev.map(s => s.stepId === msg.step_id ? { ...s, status: "blocked" } : s));
        break;

      case "final":
        setMessages(prev => [...prev, {
          id: msg.message_id || Date.now().toString(),
          role: "assistant", content: msg.content || "",
          created_at: new Date().toISOString(),
        }]);
        setIsLoading(false);
        setCurrentAgent(null);
        // DON'T clear steps — keep them visible for history
        break;

      case "cancelled":
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant", content: "⏹️ Execution was cancelled.",
          created_at: new Date().toISOString(),
        }]);
        setIsLoading(false);
        setCurrentAgent(null);
        break;

      case "error":
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant", content: formatErrorMessage(msg.content || ""),
          created_at: new Date().toISOString(),
        }]);
        setIsLoading(false);
        setCurrentAgent(null);
        break;
    }
  }

  function formatErrorMessage(raw: string): string {
    // Clean up rate limit errors
    if (raw.includes("rate_limit_exceeded") || raw.includes("429")) {
      const waitMatch = raw.match(/try again in (\d+m[\d.]+s|\d+s)/i);
      const waitTime = waitMatch ? waitMatch[1] : "a few minutes";
      return `⚠️ **Rate limit reached** — The LLM provider has reached its token limit. Please wait ${waitTime} and try again.\n\nTo avoid this, you can add additional LLM providers (OpenAI, Anthropic, Gemini) in your \`.env\` file for automatic failover.`;
    }
    if (raw.includes("All LLM providers failed")) {
      return "⚠️ **All LLM providers failed** — No API keys have available quota. Please check your API key limits or add additional providers.";
    }
    return `⚠️ ${raw}`;
  }

  function handleApproval(approved: boolean) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ approved }));
    }
    if (approved) {
      setSteps(prev => prev.map(s => s.stepId === approvalData?.stepId ? { ...s, status: "running" } : s));
    }
    setApprovalData(null);
  }

  async function handleStop() {
    if (conversationId) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "cancel" }));
      }
      await cancelTask(conversationId);
    }
    setIsLoading(false);
  }

  async function handleSend() {
    if (!input.trim() || !conversationId || isLoading) return;
    const text = input.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: "user", content: text, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    // Keep previous steps visible, add new ones below
    setSteps([]);
    setIteration(0);

    // Update title for first message
    if (messages.length === 0) {
      onTitleUpdate?.(text.substring(0, 50) + (text.length > 50 ? "..." : ""));
    }

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const ws = connectWS(conversationId);
    ws.onopen = () => { ws.send(JSON.stringify({ message: text })); };
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // Auto-resize textarea — GROW with content, no internal scroll
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 300);
    el.style.height = newHeight + "px";
  }

  // ─── Empty State ──────────────────────────────────────────────
  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full px-6">
        {/* Logo */}
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 glow-purple relative"
          style={{ background: "var(--gradient-purple)" }}>
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082" />
          </svg>
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-3xl border border-[var(--accent-purple)]/30 animate-pulse" />
        </div>

        <h1 className="text-4xl font-bold mb-3 bg-clip-text text-transparent"
          style={{ backgroundImage: "var(--gradient-purple)" }}>Hello! I&apos;m Alan</h1>
        <p className="text-[var(--text-secondary)] text-center max-w-lg mb-12 text-sm leading-relaxed">
          Your intelligent multi-agent orchestrator. I break down complex tasks and delegate them to
          specialized subagents for code execution, file management, terminal commands, and connected tools.
        </p>

        {/* Capability cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-2xl w-full">
          {[
            { icon: "📁", title: "File Operations", desc: "Create, read, write, delete files anywhere", color: "border-green-500/20 hover:border-green-500/50" },
            { icon: "⌨️", title: "Shell Commands", desc: "Execute terminal commands on the host", color: "border-blue-500/20 hover:border-blue-500/50" },
            { icon: "💻", title: "Code Execution", desc: "Run Python, JavaScript, and more", color: "border-purple-500/20 hover:border-purple-500/50" },
            { icon: "🔧", title: "Connected Tools", desc: "Gmail, GitHub, Sheets, Discord", color: "border-orange-500/20 hover:border-orange-500/50" },
          ].map((item, i) => (
            <div key={i} className={`glass rounded-xl p-4 cursor-default transition-all border ${item.color} hover:bg-[var(--bg-hover)]`}>
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">{item.title}</p>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Example prompts */}
        <div className="mt-8 max-w-lg w-full">
          <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-[0.2em] mb-2 text-center">Try asking</p>
          <div className="space-y-1.5">
            {[
              "Create a Python fibonacci script in my Downloads folder",
              "Send an email to john@example.com about tomorrow's meeting",
              "List all files in my Desktop directory",
            ].map((example, i) => (
              <div key={i} className="glass glass-hover rounded-lg px-3 py-2 text-[11px] text-[var(--text-secondary)] cursor-default hover:text-[var(--text-primary)] transition-colors">
                &quot;{example}&quot;
              </div>
            ))}
          </div>
        </div>

        <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-[0.2em] mt-10">
          Alan Multi-Agent Orchestrator v1.0
        </p>
      </div>
    );
  }

  // ─── Active Chat ──────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* Execution Progress */}
      <ExecutionProgress
        steps={steps}
        isLoading={isLoading}
        iteration={iteration}
        currentAgent={currentAgent}
        onStop={handleStop}
      />

      {/* Messages — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" style={{ minHeight: 0 }}>
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Welcome for first message */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-xl font-bold"
                style={{ background: "var(--gradient-purple)" }}>A</div>
              <p className="text-sm text-[var(--text-secondary)]">Start a conversation with Alan</p>
              <p className="text-[10px] text-[var(--text-dim)] mt-1">Type your request below</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble key={msg.id || idx} msg={msg} />
          ))}

          {/* Inline Delegation Steps */}
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((step, i) => (
                <StepCard key={`${step.stepId}-${i}`} step={step} isLast={i === steps.length - 1 && isLoading} />
              ))}
            </div>
          )}

          {/* Thinking */}
          {isLoading && <ThinkingIndicator currentAgent={currentAgent || "alan"} iteration={iteration} />}
        </div>
      </div>

      {/* Approval Modal */}
      {approvalData && (
        <ApprovalModal
          data={approvalData}
          onApprove={() => handleApproval(true)}
          onReject={() => handleApproval(false)}
        />
      )}

      {/* Input Bar */}
      <div className="border-t border-[var(--border-color)] px-4 py-3 flex-shrink-0"
        style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="glass rounded-2xl px-4 py-3 flex items-end gap-3">
            {/* Attachment button */}
            <button className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0 mb-0.5"
              title="Attach file (coming soon)" disabled>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "Waiting for response..." : "Ask Alan anything... (Shift+Enter for new line)"}
              rows={1}
              className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)] resize-none outline-none leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "300px", overflow: "hidden" }}
              disabled={isLoading}
            />

            {isLoading ? (
              <button onClick={handleStop}
                className="p-2 rounded-xl flex-shrink-0 text-white transition-all hover:opacity-80 hover:scale-105 active:scale-95 mb-0.5"
                style={{ background: "var(--gradient-red)" }} title="Stop execution">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-xl flex-shrink-0 text-white transition-all disabled:opacity-20 hover:scale-105 active:scale-95 mb-0.5"
                style={{ background: input.trim() ? "var(--accent-purple)" : "var(--bg-hover)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-[8px] text-[var(--text-dim)]">Shift+Enter for new line</p>
            <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-[0.15em]">Alan v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
