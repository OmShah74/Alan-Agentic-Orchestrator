"use client";

import { useState, useEffect, useCallback } from "react";
import { Conversation, fetchConversations, createConversation, deleteConversation, checkHealth } from "@/lib/api";

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: (convo: Conversation) => void;
  onOpenSettings?: () => void;
  onOpenAPIKeys?: () => void;
}

// ─── Icons ──────────────────────────────────────────────────────
function IconPlus() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

// ─── Date grouping ──────────────────────────────────────────────
function getDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This Week";
    if (days < 30) return "This Month";
    return "Older";
  } catch {
    return "Recent";
  }
}

function groupConversations(convos: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  convos.forEach(c => {
    const label = getDateLabel(c.updated_at || c.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(c);
  });
  return groups;
}

// ─── Component ──────────────────────────────────────────────────
export default function Sidebar({ activeConversationId, onSelectConversation, onNewChat, onOpenSettings, onOpenAPIKeys }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    const check = async () => setIsOnline(await checkHealth());
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadConversations = useCallback(async () => {
    try { setConversations(await fetchConversations()); } catch { /* ignore */ }
  }, []);

  // Reload conversations on activeConversationId change for title updates
  useEffect(() => {
    if (activeConversationId) {
      const timer = setTimeout(loadConversations, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeConversationId, loadConversations]);

  async function handleNewChat() {
    try {
      const convo = await createConversation();
      setConversations(prev => [convo as Conversation, ...prev]);
      onNewChat(convo as Conversation);
    } catch (err) { console.error(err); }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) onSelectConversation("");
      setConfirmDelete(null);
    } catch (err) { console.error(err); }
  }

  const filtered = conversations.filter(c =>
    !searchQuery || (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const grouped = groupConversations(filtered);
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older", "Recent"];

  // ─── Collapsed ────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <aside className="w-[52px] h-full flex flex-col items-center py-3 gap-3 border-r border-[var(--border-color)] flex-shrink-0"
        style={{ background: "var(--bg-secondary)" }}>
        <button onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors" title="Expand sidebar">
          <IconExpand />
        </button>
        <button onClick={handleNewChat}
          className="p-2 rounded-lg text-white transition-all hover:opacity-80 hover:scale-105"
          style={{ background: "var(--accent-purple)" }} title="New Chat">
          <IconPlus />
        </button>
        <div className="mt-auto space-y-2 flex flex-col items-center">
          {onOpenSettings && (
            <button onClick={onOpenSettings}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]" title="Settings">
              <IconSettings />
            </button>
          )}
          <span className={`w-2 h-2 rounded-full block ${isOnline ? "bg-[var(--accent-green)] pulse-dot" : "bg-[var(--accent-red)]"}`} />
        </div>
      </aside>
    );
  }

  // ─── Full Sidebar ─────────────────────────────────────────────
  return (
    <aside className="w-[270px] h-full flex flex-col border-r border-[var(--border-color)] flex-shrink-0"
      style={{ background: "var(--bg-secondary)" }}>

      {/* Header */}
      <div className="px-3 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg"
            style={{ background: "var(--gradient-purple)" }}>A</div>
          <div>
            <span className="text-sm font-bold block leading-none text-[var(--text-primary)]">Alan</span>
            <span className="text-[9px] text-[var(--text-muted)] leading-none">Multi-Agent Orchestrator</span>
          </div>
        </div>
        <button onClick={() => setIsCollapsed(true)}
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]" title="Collapse">
          <IconCollapse />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <button onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--gradient-purple-button)" }}>
          <IconPlus /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-purple)] transition-colors"
          />
        </div>
      </div>

      {/* Conversation List — grouped by date */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        {filtered.length === 0 ? (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-lg"
              style={{ background: "var(--bg-tertiary)" }}>💬</div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
            <p className="text-[10px] text-[var(--text-dim)] mt-1">
              {searchQuery ? "Try a different search" : "Click New Chat to start"}
            </p>
          </div>
        ) : (
          groupOrder.filter(g => grouped[g]).map(groupLabel => (
            <div key={groupLabel} className="mb-2">
              <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-[0.15em] px-2 mb-1 mt-2">{groupLabel}</p>
              {grouped[groupLabel].map(convo => {
                const isActive = activeConversationId === convo.id;
                const isConfirming = confirmDelete === convo.id;
                return (
                  <button key={convo.id} onClick={() => onSelectConversation(convo.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center justify-between group transition-all duration-150 border ${
                      isActive
                        ? "border-[var(--accent-purple)]/40 glow-purple"
                        : "border-transparent hover:bg-[var(--bg-hover)] hover:border-[var(--border-color)]"
                    }`}
                    style={isActive ? { background: "var(--bg-tertiary)" } : undefined}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`flex-shrink-0 ${isActive ? "text-[var(--accent-purple)]" : "text-[var(--text-dim)]"}`}>
                        <IconChat />
                      </span>
                      <span className={`truncate text-[12px] ${isActive ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"}`}>
                        {convo.title || "New Chat"}
                      </span>
                    </div>
                    <button onClick={(e) => handleDelete(e, convo.id)}
                      className={`flex-shrink-0 p-1 rounded transition-all ${
                        isConfirming
                          ? "opacity-100 bg-[var(--accent-red-dim)] text-[var(--accent-red)]"
                          : "opacity-0 group-hover:opacity-100 hover:bg-[var(--accent-red-dim)] text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                      }`}
                      title={isConfirming ? "Click again to confirm" : "Delete"}>
                      {isConfirming ? (
                        <span className="text-[8px] font-bold">DEL?</span>
                      ) : (
                        <IconTrash />
                      )}
                    </button>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-2 py-2 border-t border-[var(--border-color)] flex-shrink-0 space-y-1">
        {onOpenSettings && (
          <button onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
            <IconSettings /> Settings
          </button>
        )}
        <button onClick={onOpenAPIKeys}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
          <IconKey /> API Keys
        </button>

        <div className="flex items-center justify-between px-3 py-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[var(--accent-green)] pulse-dot" : "bg-[var(--accent-red)]"}`} />
            <span className="text-[9px] text-[var(--text-muted)]">
              {isOnline ? "Backend Online" : "Backend Offline"}
            </span>
          </div>
          <span className="text-[9px] text-[var(--text-dim)]">v1.0</span>
        </div>
      </div>
    </aside>
  );
}
