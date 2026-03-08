"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export default function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => <h1 className="text-lg font-bold text-[var(--text-primary)] mb-2 mt-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1.5 mt-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 mt-2">{children}</h3>,

          // Paragraphs
          p: ({ children }) => <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2 last:mb-0">{children}</p>,

          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-[13px]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-[13px]">{children}</ol>,
          li: ({ children }) => <li className="text-[var(--text-primary)]">{children}</li>,

          // Code blocks
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--accent-purple-light)] text-[11px] font-mono border border-[var(--border-color)]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`block text-[11px] font-mono ${codeClassName || ""}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-3 mb-2 overflow-x-auto overflow-y-auto max-h-60 text-[11px] font-mono text-green-300">
              {children}
            </pre>
          ),

          // Strong / Bold
          strong: ({ children }) => <strong className="font-semibold text-[var(--accent-purple-light)]">{children}</strong>,

          // Links
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-[var(--accent-purple)] underline hover:text-[var(--accent-purple-light)] transition-colors">
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--accent-purple)] pl-3 my-2 text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="w-full text-[11px] border-collapse border border-[var(--border-color)]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-left font-semibold text-[var(--text-primary)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--border-color)] px-2 py-1 text-[var(--text-secondary)]">
              {children}
            </td>
          ),

          // Horizontal rule
          hr: () => <hr className="border-[var(--border-color)] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
