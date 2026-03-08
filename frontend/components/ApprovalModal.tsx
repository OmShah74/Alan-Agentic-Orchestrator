"use client";

import { ApprovalData } from "@/lib/api";

interface ApprovalModalProps {
  data: ApprovalData;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApprovalModal({ data, onApprove, onReject }: ApprovalModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in p-4">
      <div className="glass rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden glow-purple">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-yellow-dim)" }}>
            <svg className="w-5 h-5 text-[var(--accent-yellow)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Permission Required</h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Subagent <span className="text-[var(--accent-yellow)] font-medium">{data.agent}</span> needs approval
            </p>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Blocked action */}
          <div>
            <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">Blocked Action</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed break-words">{data.message}</p>
          </div>

          {/* Command Snapshot */}
          {data.command && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-1">Command Snapshot</p>
              <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border-color)] overflow-x-auto">
                <code className="text-xs text-[var(--accent-orange)] font-mono whitespace-pre-wrap break-all">
                  {data.command}
                </code>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="rounded-lg p-2.5 border" style={{ background: "var(--accent-red-dim)", borderColor: "rgba(239,68,68,0.2)" }}>
            <p className="text-[11px] text-[var(--accent-red)] flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
              <span>This action was blocked by security guardrails. Review carefully before approving.</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] flex justify-end gap-2 flex-shrink-0">
          <button onClick={onReject}
            className="px-4 py-2 rounded-lg text-xs font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all">
            Reject
          </button>
          <button onClick={onApprove}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ background: "var(--gradient-green)" }}>
            Approve & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
