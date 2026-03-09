"use client";

import { useState, useEffect, useCallback } from "react";
import { APIKeyInfo, fetchAPIKeys, addAPIKey, removeAPIKey, validateAPIKey } from "@/lib/api";

interface APIKeysPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  { id: "groq", name: "Groq", icon: "⚡", color: "text-orange-400", model: "llama-3.3-70b-versatile", desc: "Fastest inference for open-source models" },
  { id: "openai", name: "OpenAI", icon: "🤖", color: "text-green-400", model: "gpt-4o", desc: "Most capable general-purpose model" },
  { id: "anthropic", name: "Anthropic", icon: "🧠", color: "text-blue-400", model: "claude-3-5-sonnet", desc: "Best for complex reasoning and coding" },
  { id: "gemini", name: "Google Gemini", icon: "💎", color: "text-cyan-400", model: "gemini-1.5-pro", desc: "Large context window, multimodal" },
  { id: "openrouter", name: "OpenRouter", icon: "🌐", color: "text-pink-400", model: "anthropic/claude-3.5-sonnet", desc: "Access multiple providers via one API" },
];

const COMPOSIO_TOOLS = [
  { name: "Gmail", icon: "📧", connected: true },
  { name: "GitHub", icon: "🐙", connected: true },
  { name: "Google Sheets", icon: "📊", connected: true },
  { name: "Discord", icon: "🎮", connected: true },
  { name: "Canva", icon: "🎨", connected: true },
];

export default function APIKeysPanel({ isOpen, onClose }: APIKeysPanelProps) {
  const [keys, setKeys] = useState<Record<string, APIKeyInfo[]>>({});
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const data = await fetchAPIKeys();
    setKeys(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) loadKeys();
  }, [isOpen, loadKeys]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setAddingProvider(null); onClose(); }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function handleValidate() {
    if (!addingProvider || !newKeyValue.trim()) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateAPIKey(addingProvider, newKeyValue.trim());
      setValidationResult(result);
    } catch {
      setValidationResult({ valid: false, message: "Validation request failed" });
    }
    setValidating(false);
  }

  async function handleAddKey() {
    if (!addingProvider || !newKeyValue.trim()) return;
    const name = newKeyName.trim() || `${addingProvider}_key_${Date.now().toString(36)}`;
    try {
      await addAPIKey(addingProvider, name, newKeyValue.trim());
      setAddingProvider(null);
      setNewKeyValue("");
      setNewKeyName("");
      setValidationResult(null);
      await loadKeys();
    } catch (e) {
      setValidationResult({ valid: false, message: String(e) });
    }
  }

  async function handleRemoveKey(provider: string, name: string) {
    await removeAPIKey(provider, name);
    await loadKeys();
  }

  const totalKeys = Object.values(keys).reduce((sum, arr) => sum + arr.length, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <div className="glass rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden glow-purple">

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
              <p className="text-[10px] text-[var(--text-muted)]">{totalKeys} key{totalKeys !== 1 ? "s" : ""} configured · Round-robin rotation enabled</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Rotation explanation */}
        <div className="px-5 py-2 border-b border-[var(--border-color)]" style={{ background: "var(--accent-blue-dim)" }}>
          <p className="text-[10px] text-[var(--accent-blue)] leading-relaxed">
            <strong>Rotation order:</strong> groq_key1 → groq_key2 → ... → openai_key1 → openai_key2 → ... → anthropic → gemini → openrouter.
            If a key hits rate limit, the next key is tried automatically. Add <strong>unlimited</strong> keys per provider.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && (
            <div className="text-center py-4">
              <span className="text-[11px] text-[var(--text-muted)]">Loading keys...</span>
            </div>
          )}

          {PROVIDERS.map(provider => {
            const providerKeys = keys[provider.id] || [];
            const isAdding = addingProvider === provider.id;

            return (
              <div key={provider.id} className="rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ background: "var(--bg-card)" }}>
                {/* Provider header */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{provider.icon}</span>
                    <div>
                      <span className={`text-sm font-semibold ${provider.color}`}>{provider.name}</span>
                      <p className="text-[9px] text-[var(--text-muted)]">{provider.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                      providerKeys.length > 0
                        ? "bg-green-500/15 text-green-400 border border-green-500/20"
                        : "bg-gray-500/15 text-gray-400 border border-gray-500/20"
                    }`}>
                      {providerKeys.length > 0 ? `${providerKeys.length} key${providerKeys.length > 1 ? "s" : ""}` : "No keys"}
                    </span>
                    <button onClick={() => { setAddingProvider(isAdding ? null : provider.id); setNewKeyValue(""); setNewKeyName(""); setValidationResult(null); }}
                      className={`px-2 py-1 rounded-lg text-[9px] font-medium transition-all border ${
                        isAdding
                          ? "border-[var(--accent-red)] text-[var(--accent-red)] hover:bg-[var(--accent-red-dim)]"
                          : "border-[var(--accent-purple)]/30 text-[var(--accent-purple)] hover:bg-[var(--accent-purple-glow)]"
                      }`}>
                      {isAdding ? "Cancel" : "+ Add Key"}
                    </button>
                  </div>
                </div>

                {/* Existing keys */}
                {providerKeys.length > 0 && (
                  <div className="border-t border-[var(--border-color)]">
                    {providerKeys.map((k, idx) => (
                      <div key={k.name} className="px-4 py-2 flex items-center justify-between border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-[11px] text-[var(--text-primary)] font-medium">{k.name}</span>
                          <code className="text-[10px] text-[var(--text-dim)] font-mono">{k.masked_key}</code>
                          {k.request_count > 0 && (
                            <span className="text-[8px] text-[var(--text-dim)]">{k.request_count} requests</span>
                          )}
                          <span className="text-[8px] text-[var(--text-dim)]">#{idx + 1} priority</span>
                        </div>
                        <button onClick={() => handleRemoveKey(provider.id, k.name)}
                          className="px-2 py-0.5 rounded text-[9px] text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add key form */}
                {isAdding && (
                  <div className="px-4 py-3 border-t border-[var(--accent-purple)]/20 fade-in" style={{ background: "var(--accent-purple-glow)" }}>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newKeyName}
                          onChange={e => setNewKeyName(e.target.value)}
                          placeholder={`${provider.id}_key_${providerKeys.length + 1}`}
                          className="w-36 px-2 py-1.5 rounded-lg text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-purple)] font-mono"
                        />
                        <input
                          type="password"
                          value={newKeyValue}
                          onChange={e => { setNewKeyValue(e.target.value); setValidationResult(null); }}
                          placeholder="Paste your API key..."
                          autoFocus
                          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-purple)] font-mono"
                          onKeyDown={e => { if (e.key === "Enter") handleAddKey(); }}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={handleValidate} disabled={!newKeyValue.trim() || validating}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium border border-[var(--accent-blue)]/30 text-[var(--accent-blue)] hover:bg-[var(--accent-blue-dim)] disabled:opacity-40 transition-all">
                          {validating ? "Validating..." : "🔍 Validate"}
                        </button>
                        <button onClick={handleAddKey} disabled={!newKeyValue.trim()}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white disabled:opacity-40 transition-all"
                          style={{ background: "var(--gradient-green)" }}>
                          ✅ Add Key
                        </button>

                        {validationResult && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            validationResult.valid
                              ? "bg-green-500/15 text-green-400"
                              : "bg-red-500/15 text-red-400"
                          }`}>
                            {validationResult.valid ? "✅ " : "❌ "}{validationResult.message}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Composio Tools */}
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Connected Tools (Composio)</h3>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">
              These tools are already connected and ready to use. Alan will automatically use them when needed.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {COMPOSIO_TOOLS.map(tool => (
                <div key={tool.name}
                  className="rounded-lg border border-green-500/20 bg-green-500/5 p-2 flex items-center gap-2">
                  <span className="text-sm">{tool.icon}</span>
                  <span className="text-[11px] font-medium text-[var(--text-primary)]">{tool.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <p className="text-[9px] text-[var(--text-dim)]">
            Keys are stored locally and rotated automatically on rate limits.
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
