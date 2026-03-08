"use client";

import { useState, useEffect, useCallback } from "react";
import { DelegationStep } from "@/lib/api";

interface SubagentPanelProps {
  steps: DelegationStep[];
  onClose: () => void;
}

const AGENT_STYLES: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  command_executor: { icon: "⌨️", color: "#3b82f6", label: "Command Executor", bg: "rgba(59,130,246,0.1)" },
  file_operator:    { icon: "📁", color: "#10b981", label: "File Operator", bg: "rgba(16,185,129,0.1)" },
  code_executor:    { icon: "💻", color: "#a78bfa", label: "Code Executor", bg: "rgba(167,139,250,0.1)" },
  tool_executor:    { icon: "🔧", color: "#f59e0b", label: "Tool Executor", bg: "rgba(245,158,11,0.1)" },
  local_executor:   { icon: "🖥️", color: "#06b6d4", label: "Local Executor", bg: "rgba(6,182,212,0.1)" },
};

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  success: { icon: "✅", color: "text-green-400" },
  error: { icon: "❌", color: "text-red-400" },
  running: { icon: "⚙️", color: "text-blue-400" },
  blocked: { icon: "🔒", color: "text-yellow-400" },
  pending: { icon: "⏳", color: "text-gray-400" },
};

export default function SubagentPanel({ steps, onClose }: SubagentPanelProps) {
  const [filter, setFilter] = useState<string>("all");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-expand the latest step
  useEffect(() => {
    if (steps.length > 0) {
      setExpandedSteps(prev => new Set([...prev, steps.length - 1]));
    }
  }, [steps.length]);

  const toggleStep = useCallback((idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const filteredSteps = steps.filter(step => {
    if (filter !== "all" && step.agent !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        step.agent.toLowerCase().includes(q) ||
        step.action.toLowerCase().includes(q) ||
        (step.stdout || "").toLowerCase().includes(q) ||
        (step.stderr || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: steps.length,
    success: steps.filter(s => s.status === "success").length,
    error: steps.filter(s => s.status === "error").length,
    running: steps.filter(s => s.status === "running").length,
  };

  // Agent breakdown
  const agentCounts: Record<string, number> = {};
  steps.forEach(s => { agentCounts[s.agent] = (agentCounts[s.agent] || 0) + 1; });

  return (
    <div className="fixed top-0 right-0 w-96 h-full z-[100] glass border-l border-[var(--border-color)] flex flex-col slide-right">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Execution Details</h3>
          <p className="text-[10px] text-[var(--text-muted)]">
            {stats.total} steps · {stats.success} passed · {stats.error} failed
            {stats.running > 0 && ` · ${stats.running} active`}
          </p>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]" title="Close panel">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] flex-shrink-0">
        {/* Progress bar */}
        <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
          <div className="h-full flex">
            <div className="bg-green-400 transition-all" style={{ width: `${(stats.success / Math.max(stats.total, 1)) * 100}%` }} />
            <div className="bg-red-400 transition-all" style={{ width: `${(stats.error / Math.max(stats.total, 1)) * 100}%` }} />
            <div className="bg-blue-400 transition-all pulse-dot" style={{ width: `${(stats.running / Math.max(stats.total, 1)) * 100}%` }} />
          </div>
        </div>

        {/* Agent breakdown */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button onClick={() => setFilter("all")}
            className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-all border ${
              filter === "all" ? "border-[var(--accent-purple)] bg-[var(--accent-purple-glow)] text-[var(--accent-purple-light)]" : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent-purple)]/40"
            }`}>All ({stats.total})</button>
          {Object.entries(agentCounts).map(([agent, count]) => {
            const style = AGENT_STYLES[agent] || { icon: "🤖", color: "#9ca3af", label: agent, bg: "transparent" };
            return (
              <button key={agent} onClick={() => setFilter(filter === agent ? "all" : agent)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-all border flex items-center gap-1 ${
                  filter === agent ? "border-[var(--accent-purple)] bg-[var(--accent-purple-glow)] text-[var(--accent-purple-light)]" : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent-purple)]/40"
                }`}>
                <span className="text-[8px]">{style.icon}</span>
                {count}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search steps..."
            className="w-full pl-7 pr-3 py-1 rounded-lg text-[10px] bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent-purple)] transition-colors"
          />
        </div>
      </div>

      {/* Steps list — scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {filteredSteps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[11px] text-[var(--text-muted)]">No steps match filter</p>
          </div>
        ) : (
          filteredSteps.map((step, i) => {
            const originalIdx = steps.indexOf(step);
            const agent = AGENT_STYLES[step.agent] || { icon: "🤖", color: "#9ca3af", label: step.agent, bg: "transparent" };
            const statusInfo = STATUS_ICONS[step.status] || STATUS_ICONS.pending;
            const isExpanded = expandedSteps.has(originalIdx);

            return (
              <div key={`${step.stepId}-${i}`} className="rounded-xl border border-[var(--border-color)] overflow-hidden fade-in"
                style={{ background: "var(--bg-card)" }}>
                
                {/* Step header */}
                <button onClick={() => toggleStep(originalIdx)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: agent.bg }}>
                    {agent.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: agent.color }}>{agent.label}</span>
                      <span className="text-[8px] text-[var(--text-dim)] font-mono">#{step.stepNumber}</span>
                    </div>
                    {step.action && (
                      <code className="text-[10px] text-[var(--text-muted)] font-mono">{step.action}</code>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] ${statusInfo.color}`}>{statusInfo.icon}</span>
                    <svg className={`w-3 h-3 text-[var(--text-dim)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-color)] pt-2">
                    {step.payload?.parameters && (
                      <div>
                        <p className="text-[9px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">📋 Parameters</p>
                        <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                          {Object.entries(step.payload.parameters).map(([k, v]) => (
                            <div key={k} className="flex border-b border-[var(--border-color)] last:border-0">
                              <span className="text-[10px] text-[var(--accent-purple-light)] font-mono px-2 py-1 bg-[var(--bg-tertiary)] w-20 flex-shrink-0">{k}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] font-mono px-2 py-1 break-all whitespace-pre-wrap flex-1">
                                {typeof v === "string" ? (v.length > 300 ? v.substring(0, 300) + "…" : v) : JSON.stringify(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {step.stdout && (
                      <div>
                        <p className="text-[9px] font-bold text-green-500/70 uppercase tracking-wider mb-1">📤 Output</p>
                        <pre className="text-[10px] text-green-300 bg-[var(--bg-primary)] rounded-lg p-2 overflow-auto max-h-32 font-mono whitespace-pre-wrap border border-green-500/10">{step.stdout}</pre>
                      </div>
                    )}

                    {step.stderr && (
                      <div>
                        <p className="text-[9px] font-bold text-red-500/70 uppercase tracking-wider mb-1">⚠️ Error</p>
                        <pre className="text-[10px] text-red-300 bg-[var(--bg-primary)] rounded-lg p-2 overflow-auto max-h-32 font-mono whitespace-pre-wrap border border-red-500/10">{step.stderr}</pre>
                      </div>
                    )}

                    <p className="text-[8px] text-[var(--text-dim)] text-right">
                      {step.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border-color)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-[var(--text-dim)]">
            {steps.filter(s => s.status === "running").length > 0 ? "Execution in progress..." : "Execution complete"}
          </p>
          <button onClick={() => setExpandedSteps(new Set(steps.map((_, i) => i)))}
            className="text-[9px] text-[var(--accent-purple)] hover:text-[var(--accent-purple-light)] transition-colors">
            Expand All
          </button>
        </div>
      </div>
    </div>
  );
}
