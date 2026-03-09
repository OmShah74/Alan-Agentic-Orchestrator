"use client";

import { useState, useEffect } from "react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ThemeId = "deep-space" | "midnight" | "amoled";

const THEMES: { id: ThemeId; name: string; accent: string; bg: string; desc: string }[] = [
  { id: "deep-space", name: "Deep Space", accent: "#7c3aed", bg: "#050508", desc: "Purple accents on dark background" },
  { id: "midnight", name: "Midnight", accent: "#3b82f6", bg: "#0f1218", desc: "Cool blue on slate gray" },
  { id: "amoled", name: "AMOLED", accent: "#10b981", bg: "#000000", desc: "Emerald on pure black" },
];

function applyTheme(themeId: ThemeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem("alan-theme", themeId);
}

function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "deep-space";
  return (localStorage.getItem("alan-theme") as ThemeId) || "deep-space";
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState<ThemeId>("deep-space");
  const [maxIter, setMaxIter] = useState(15);

  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function handleThemeChange(id: ThemeId) {
    setTheme(id);
    applyTheme(id);
  }

  const tabs = [
    { id: "general", label: "General", icon: "⚙️" },
    { id: "providers", label: "LLM Providers", icon: "🤖" },
    { id: "guardrails", label: "Guardrails", icon: "🛡️" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <div className="glass rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden glow-purple">

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

        {/* Tab Bar */}
        <div className="flex border-b border-[var(--border-color)] px-4 flex-shrink-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[11px] font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-[var(--accent-purple)] text-[var(--accent-purple)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}>
              <span className="mr-1">{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">

          {/* ─── General ──── */}
          {activeTab === "general" && (
            <div className="space-y-5 fade-in">
              {/* Theme selection */}
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => handleThemeChange(t.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        theme === t.id
                          ? "border-[var(--accent-purple)] glow-purple"
                          : "border-[var(--border-color)] hover:border-[var(--accent-purple)]/40"
                      }`}
                      style={{ background: theme === t.id ? "var(--accent-purple-glow)" : "var(--bg-card)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full border-2"
                          style={{ background: t.bg, borderColor: t.accent }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--text-primary)]">{t.name}</p>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Iterations */}
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Max Iterations</h3>
                <p className="text-[10px] text-[var(--text-muted)] mb-2">Safety limit per task execution</p>
                <div className="flex items-center gap-3">
                  <input type="range" min="5" max="50" value={maxIter}
                    onChange={e => setMaxIter(Number(e.target.value))}
                    className="flex-1 accent-[var(--accent-purple)]" />
                  <span className="text-xs font-mono text-[var(--accent-purple)] w-8 text-center">{maxIter}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── LLM Providers ──── */}
          {activeTab === "providers" && (
            <div className="space-y-3 fade-in">
              <p className="text-[11px] text-[var(--text-muted)] mb-3">
                Manage your API keys through the <strong>API Keys</strong> panel in the sidebar.
                Keys are rotated automatically: if one key hits a rate limit, the next is tried.
              </p>
              <div className="rounded-xl border border-[var(--border-color)] p-4" style={{ background: "var(--bg-card)" }}>
                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Supported Providers</h4>
                <div className="space-y-2">
                  {[
                    { name: "Groq", model: "llama-3.3-70b-versatile", icon: "⚡", desc: "Fastest inference" },
                    { name: "OpenAI", model: "gpt-4o", icon: "🤖", desc: "Most capable" },
                    { name: "Anthropic", model: "claude-3.5-sonnet", icon: "🧠", desc: "Best reasoning" },
                    { name: "Gemini", model: "gemini-1.5-pro", icon: "💎", desc: "Large context" },
                    { name: "OpenRouter", model: "multiple", icon: "🌐", desc: "Multi-provider" },
                  ].map(p => (
                    <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-[var(--border-color)] last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{p.icon}</span>
                        <div>
                          <span className="text-[11px] font-medium text-[var(--text-primary)]">{p.name}</span>
                          <span className="text-[9px] text-[var(--text-dim)] ml-1">{p.desc}</span>
                        </div>
                      </div>
                      <code className="text-[9px] text-[var(--text-muted)] font-mono">{p.model}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Guardrails ──── */}
          {activeTab === "guardrails" && (
            <div className="space-y-3 fade-in">
              <p className="text-[11px] text-[var(--text-muted)] mb-3">
                Guardrails protect your system from unintended or harmful actions.
              </p>
              {[
                { tier: "Tier 1", label: "Auto-approved", color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/5",
                  examples: ["Read files", "List directories", "View code", "Execute Python snippets"], desc: "Safe, read-only operations" },
                { tier: "Tier 2", label: "Auto-approved (workspace)", color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/5",
                  examples: ["Write files to /host_c/", "Create directories", "Modify code"], desc: "File operations within workspace" },
                { tier: "Tier 3", label: "Requires approval", color: "text-yellow-400", border: "border-yellow-500/20", bg: "bg-yellow-500/5",
                  examples: ["pip install", "System commands", "Network requests", "Package management"], desc: "Potentially system-modifying" },
              ].map(tier => (
                <div key={tier.tier} className={`rounded-xl border ${tier.border} ${tier.bg} p-3`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${tier.color}`}>{tier.tier}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} border ${tier.border}`}>{tier.label}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mb-1.5">{tier.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {tier.examples.map(ex => (
                      <span key={ex} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]">{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── About ──── */}
          {activeTab === "about" && (
            <div className="space-y-4 fade-in">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white shadow-xl"
                  style={{ background: "var(--gradient-purple)" }}>A</div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Alan Orchestrator</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Multi-Agent AI System</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-mono rounded-full bg-[var(--accent-purple-glow)] text-[var(--accent-purple)]">v1.0.0</span>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-3" style={{ background: "var(--bg-card)" }}>
                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Architecture</h4>
                <div className="space-y-1.5 text-[10px] text-[var(--text-secondary)]">
                  <p>• <strong>Orchestrator:</strong> Breaks tasks into sub-tasks, manages agent delegation</p>
                  <p>• <strong>File Operator:</strong> File CRUD operations on host filesystem</p>
                  <p>• <strong>Command Executor:</strong> Shell commands in Docker containers</p>
                  <p>• <strong>Code Executor:</strong> Python/JS code execution in sandboxed env</p>
                  <p>• <strong>Tool Executor:</strong> Composio integrations (Gmail, GitHub, etc.)</p>
                  <p>• <strong>Local Executor:</strong> System-level operations with guardrails</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2 rounded-xl text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
