import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Alan - Multi-Agent Orchestrator",
  description: "Intelligent multi-agent orchestrator with recursive task planning and execution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Inline script to apply theme before paint (prevents flash of wrong theme)
  const themeScript = `
    (function() {
      try {
        var t = localStorage.getItem('alan-theme') || 'deep-space';
        document.documentElement.setAttribute('data-theme', t);
      } catch(e) {}
    })();
  `;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
