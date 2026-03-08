"use client";

import { useState, useEffect } from "react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderStatus {
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  model: string;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"general" | "providers" | "guardrails" | "about">("general");
  const [providers] = useState<ProviderStatus[]>([
    { name: "Groq", icon: "⚡", color: "text-orange-400", enabled: true, model: "llama-3.3-70b-versatile" },
    { name: "OpenAI", icon: "🤖", color: "text-green-400", enabled: false, model: "gpt-4o" },
    { name: "Anthropic", icon: "🧠", color: "text-blue-400", enabled: false, model: "claude-3.5-sonnet" },
    { name: "Gemini", icon: "💎", color: "text-cyan-400", enabled: false, model: "gemini-1.5-pro" },
  ]);

  const [theme, setTheme] = useState("dark");
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxIterations, setMaxIterations] = useState(20);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const tabs = [
    { key: "general" as const, label: "General", icon: "⚙️" },
    { key: "providers" as const, label: "LLM Providers", icon: "🧠" },
    { key: "guardrails" as const, label: "Guardrails", icon: "🛡️" },
    { key: "about" as const, label: "About", icon: "ℹ️" },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden glow-purple">

        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Settings</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Tab sidebar */}
          <div className="w-44 border-r border-[var(--border-color)] py-2 px-2 flex-shrink-0">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[12px] flex items-center gap-2 mb-0.5 transition-all ${
                  activeTab === tab.key
                    ? "bg-[var(--accent-purple-glow)] text-[var(--accent-purple-light)] border border-[var(--accent-purple)]/30"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent"
                }`}>
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === "general" && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">Theme</label>
                  <div className="flex gap-2">
                    {["dark", "midnight", "amoled"].map(t => (
                      <button key={t} onClick={() => setTheme(t)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all capitalize ${
                          theme === t
                            ? "border-[var(--accent-purple)] bg-[var(--accent-purple-glow)] text-[var(--accent-purple-light)]"
                            : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent-purple)]/50"
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">Max Iterations</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={5} max={50} value={maxIterations}
                      onChange={e => setMaxIterations(Number(e.target.value))}
                      className="flex-1 accent-[var(--accent-purple)]" />
                    <span className="text-xs text-[var(--text-primary)] font-mono w-8 text-right">{maxIterations}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Maximum planning iterations per task</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">Workspace Directory</label>
                  <input type="text" value="/workspace" readOnly
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-muted)] font-mono" />
                </div>
              </>
            )}

            {activeTab === "providers" && (
              <>
                <p className="text-[11px] text-[var(--text-secondary)] mb-3">
                  LLM providers are configured via environment variables in your <code className="text-[var(--accent-purple-light)]">.env</code> file.
                  The orchestrator uses the first available provider and falls back to others on failure.
                </p>
                <div className="space-y-2">
                  {providers.map(p => (
                    <div key={p.name}
                      className={`rounded-xl border p-3 transition-all ${
                        p.enabled
                          ? "border-[var(--accent-green)]/30 bg-[var(--accent-green-dim)]"
                          : "border-[var(--border-color)] bg-[var(--bg-card)]"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{p.icon}</span>
                          <div>
                            <span className={`text-xs font-semibold ${p.color}`}>{p.name}</span>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono">{p.model}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                          p.enabled ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
                        }`}>
                          {p.enabled ? "Active" : "No API Key"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg p-2.5 border mt-2" style={{ background: "var(--accent-blue-dim)", borderColor: "rgba(59,130,246,0.2)" }}>
                  <p className="text-[10px] text-[var(--accent-blue)]">
                    💡 To enable a provider, add its API key to your <code>.env</code> file (e.g., <code>OPENAI_API_KEY=sk-...</code>) and restart Docker.
                  </p>
                </div>
              </>
            )}

            {activeTab === "guardrails" && (
              <>
                <p className="text-[11px] text-[var(--text-secondary)] mb-3">
                  The security guardrail system evaluates every action before execution.
                </p>
                <div className="space-y-2">
                  {[
                    { tier: "Tier 1 — Safe", desc: "Read operations, ls, cat, echo", color: "text-green-400", bg: "bg-green-500/10", action: "Auto-approved" },
                    { tier: "Tier 2 — Low Risk", desc: "File writes in user directories, mkdir", color: "text-blue-400", bg: "bg-blue-500/10", action: "Auto-approved" },
                    { tier: "Tier 3 — High Risk", desc: "System paths, network commands, pip install", color: "text-yellow-400", bg: "bg-yellow-500/10", action: "Requires approval" },
                    { tier: "Tier 4 — Critical", desc: "rm -rf, format, system modification", color: "text-red-400", bg: "bg-red-500/10", action: "Strictly blocked" },
                  ].map(t => (
                    <div key={t.tier} className={`rounded-xl border border-[var(--border-color)] p-3 ${t.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-semibold ${t.color}`}>{t.tier}</span>
                        <span className="text-[9px] text-[var(--text-muted)]">{t.action}</span>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)]">{t.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider block">Auto-Approve Tier 3</label>
                      <p className="text-[10px] text-[var(--text-muted)]">Skip approval dialog for Tier 3 actions</p>
                    </div>
                    <button onClick={() => setAutoApprove(!autoApprove)}
                      className={`w-10 h-5 rounded-full transition-all flex items-center ${
                        autoApprove ? "bg-[var(--accent-purple)] justify-end" : "bg-[var(--bg-hover)] justify-start"
                      }`}>
                      <span className="w-4 h-4 rounded-full bg-white mx-0.5 transition-all" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
                    style={{ background: "var(--gradient-purple)" }}>A</div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Alan Orchestrator</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Multi-Agent System v1.0</p>
                </div>

                <div className="space-y-1.5">
                  {[
                    { label: "Architecture", value: "Hierarchical Multi-Agent" },
                    { label: "Subagents", value: "5 (cmd, file, code, tool, local)" },
                    { label: "Database", value: "PostgreSQL" },
                    { label: "Cache", value: "Redis" },
                    { label: "LLM Routing", value: "Dynamic failover" },
                    { label: "Guardrails", value: "4-tier security system" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between py-1 border-b border-[var(--border-color)]">
                      <span className="text-[11px] text-[var(--text-muted)]">{item.label}</span>
                      <span className="text-[11px] text-[var(--text-primary)] font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
