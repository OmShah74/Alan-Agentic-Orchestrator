"use client";

import { useState, useEffect } from "react";

interface APIKeysPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface APIKeyEntry {
  id: string;
  provider: string;
  icon: string;
  color: string;
  envVar: string;
  maskedKey: string;
  status: "active" | "inactive" | "error" | "rate_limited";
  model: string;
  description: string;
  docsUrl: string;
  lastUsed?: string;
  tokensUsed?: number;
  tokensLimit?: number;
}

const DEFAULT_PROVIDERS: APIKeyEntry[] = [
  {
    id: "groq", provider: "Groq", icon: "⚡", color: "text-orange-400",
    envVar: "GROQ_API_KEY", maskedKey: "", status: "inactive",
    model: "llama-3.3-70b-versatile", description: "Fastest inference for open-source models",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "openai", provider: "OpenAI", icon: "🤖", color: "text-green-400",
    envVar: "OPENAI_API_KEY", maskedKey: "", status: "inactive",
    model: "gpt-4o", description: "Most capable general-purpose model",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic", provider: "Anthropic", icon: "🧠", color: "text-blue-400",
    envVar: "ANTHROPIC_API_KEY", maskedKey: "", status: "inactive",
    model: "claude-3.5-sonnet", description: "Best for complex reasoning and coding",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini", provider: "Google Gemini", icon: "💎", color: "text-cyan-400",
    envVar: "GEMINI_API_KEY", maskedKey: "", status: "inactive",
    model: "gemini-1.5-pro", description: "Large context window, multimodal",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
];

const STATUS_MAP: Record<string, { label: string; badge: string; icon: string }> = {
  active: { label: "Active", badge: "bg-green-500/15 text-green-400 border-green-500/20", icon: "✅" },
  inactive: { label: "No Key", badge: "bg-gray-500/15 text-gray-400 border-gray-500/20", icon: "⬜" },
  error: { label: "Error", badge: "bg-red-500/15 text-red-400 border-red-500/20", icon: "❌" },
  rate_limited: { label: "Rate Limited", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: "⏳" },
};

export default function APIKeysPanel({ isOpen, onClose }: APIKeysPanelProps) {
  const [providers, setProviders] = useState<APIKeyEntry[]>(DEFAULT_PROVIDERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setEditingId(null); onClose(); }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function handleStartEdit(entry: APIKeyEntry) {
    setEditingId(entry.id);
    setEditValue("");
  }

  function handleSaveKey(id: string) {
    if (!editValue.trim()) { setEditingId(null); return; }
    setProviders(prev => prev.map(p =>
      p.id === id ? {
        ...p,
        maskedKey: editValue.substring(0, 8) + "..." + editValue.slice(-4),
        status: "active" as const,
      } : p
    ));
    setEditingId(null);
    setEditValue("");
  }

  function handleRemoveKey(id: string) {
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, maskedKey: "", status: "inactive" as const } : p
    ));
  }

  const activeCount = providers.filter(p => p.status === "active").length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden glow-purple">

        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-purple-glow)" }}>
              <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Key Management</h2>
              <p className="text-[10px] text-[var(--text-muted)]">{activeCount} of {providers.length} providers active</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHelp(!showHelp)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]" title="Help">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Help banner */}
        {showHelp && (
          <div className="px-5 py-3 border-b border-[var(--border-color)] fade-in" style={{ background: "var(--accent-blue-dim)" }}>
            <p className="text-[11px] text-[var(--accent-blue)] leading-relaxed">
              <strong>How API key rotation works:</strong> Alan&apos;s orchestrator tries each provider in order. If one
              fails (rate limit, error), it automatically tries the next. Add multiple providers for maximum reliability.
              Keys are stored in your <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-[10px]">.env</code> file
              and are never sent to any external service.
            </p>
          </div>
        )}

        {/* Provider list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Rotation priority banner */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-color)]" style={{ background: "var(--bg-card)" }}>
            <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-wider">Failover Priority</span>
            <div className="flex items-center gap-1 flex-1">
              {providers.map((p, i) => (
                <div key={p.id} className="flex items-center">
                  <span className={`text-[10px] font-medium ${p.status === "active" ? p.color : "text-[var(--text-dim)]"}`}>
                    {p.icon} {p.provider}
                  </span>
                  {i < providers.length - 1 && (
                    <span className="text-[8px] text-[var(--text-dim)] mx-1.5">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Provider cards */}
          {providers.map(entry => {
            const status = STATUS_MAP[entry.status];
            const isEditing = editingId === entry.id;

            return (
              <div key={entry.id}
                className={`rounded-xl border p-4 transition-all ${
                  entry.status === "active"
                    ? "border-green-500/20 bg-green-500/5"
                    : entry.status === "rate_limited"
                    ? "border-yellow-500/20 bg-yellow-500/5"
                    : "border-[var(--border-color)] bg-[var(--bg-card)]"
                }`}>

                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{entry.icon}</span>
                    <div>
                      <h3 className={`text-sm font-semibold ${entry.color}`}>{entry.provider}</h3>
                      <p className="text-[10px] text-[var(--text-muted)]">{entry.description}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${status.badge}`}>
                    {status.icon} {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                  <div>
                    <span className="text-[var(--text-dim)]">Model</span>
                    <p className="text-[var(--text-secondary)] font-mono">{entry.model}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Env Variable</span>
                    <p className="text-[var(--text-secondary)] font-mono">{entry.envVar}</p>
                  </div>
                  {entry.tokensUsed !== undefined && (
                    <>
                      <div>
                        <span className="text-[var(--text-dim)]">Tokens Used</span>
                        <p className="text-[var(--text-secondary)] font-mono">{entry.tokensUsed.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-dim)]">Limit</span>
                        <p className="text-[var(--text-secondary)] font-mono">{entry.tokensLimit?.toLocaleString() || "—"}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Key management */}
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder="Paste your API key..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--accent-purple)] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none font-mono"
                      onKeyDown={e => { if (e.key === "Enter") handleSaveKey(entry.id); if (e.key === "Escape") setEditingId(null); }}
                    />
                    <button onClick={() => handleSaveKey(entry.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white" style={{ background: "var(--gradient-green)" }}>
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-[var(--text-muted)] border border-[var(--border-color)]">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {entry.maskedKey ? (
                        <code className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                          {entry.maskedKey}
                        </code>
                      ) : (
                        <span className="text-[10px] text-[var(--text-dim)] italic">No key configured</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a href={entry.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 rounded-lg text-[9px] font-medium text-[var(--accent-purple)] hover:bg-[var(--accent-purple-glow)] transition-colors border border-[var(--accent-purple)]/20">
                        Get Key ↗
                      </a>
                      <button onClick={() => handleStartEdit(entry)}
                        className="px-2 py-1 rounded-lg text-[9px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-color)]">
                        {entry.maskedKey ? "Update" : "Add Key"}
                      </button>
                      {entry.maskedKey && (
                        <button onClick={() => handleRemoveKey(entry.id)}
                          className="px-2 py-1 rounded-lg text-[9px] font-medium text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Composio Tools */}
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Connected Tools (Composio)</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Gmail", icon: "📧", status: "connected", color: "text-red-400" },
                { name: "GitHub", icon: "🐙", status: "connected", color: "text-gray-300" },
                { name: "Google Sheets", icon: "📊", status: "connected", color: "text-green-400" },
                { name: "Discord", icon: "🎮", status: "connected", color: "text-indigo-400" },
                { name: "Canva", icon: "🎨", status: "connected", color: "text-blue-400" },
                { name: "Slack", icon: "💬", status: "not_connected", color: "text-gray-400" },
              ].map(tool => (
                <div key={tool.name}
                  className={`rounded-lg border p-2 flex items-center gap-2 ${
                    tool.status === "connected"
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-[var(--border-color)] bg-[var(--bg-card)]"
                  }`}>
                  <span className="text-sm">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[11px] font-medium ${tool.color}`}>{tool.name}</span>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${tool.status === "connected" ? "bg-green-400" : "bg-gray-400"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] text-[var(--text-dim)]">
            Keys are stored locally and never sent to external services.
          </p>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
