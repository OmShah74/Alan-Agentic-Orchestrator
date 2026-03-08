"use client";

import { useState, useEffect } from "react";
import { checkHealth } from "@/lib/api";

interface ChatHeaderProps {
  conversationId: string | null;
  conversationTitle: string;
  stepsCount: number;
  isLoading: boolean;
  onToggleSteps: () => void;
  onStop: () => void;
}

export default function ChatHeader({
  conversationId,
  conversationTitle,
  stepsCount,
  isLoading,
  onToggleSteps,
  onStop,
}: ChatHeaderProps) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const check = async () => setIsOnline(await checkHealth());
    check();
    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!conversationId) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] flex-shrink-0"
      style={{ background: "var(--bg-secondary)" }}>

      {/* Left: Title */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ background: "var(--gradient-purple)" }}>A</div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">
            {conversationTitle || "New Chat"}
          </h1>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? "bg-[var(--accent-green)] pulse-dot" : "bg-[var(--accent-red)]"}`} />
            <span className="text-[9px] text-[var(--text-muted)]">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Steps toggle */}
        {stepsCount > 0 && (
          <button onClick={onToggleSteps}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-[var(--border-color)] hover:border-[var(--accent-purple)] hover:bg-[var(--bg-hover)] transition-all text-[var(--text-secondary)]">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {stepsCount} Steps
          </button>
        )}

        {/* Stop */}
        {isLoading && (
          <button onClick={onStop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-white transition-all hover:opacity-80"
            style={{ background: "var(--gradient-red)" }}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
