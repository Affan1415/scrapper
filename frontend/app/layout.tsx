import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadScraper — Google Maps Lead Generation",
  description: "Scrape and manage business leads from Google Maps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <header className="bg-[#0F172A] border-b border-slate-700 sticky top-0 z-50">
          <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-sky-500 rounded flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <span className="text-white font-semibold tracking-tight">LeadScraper</span>
              </a>
              <nav className="flex items-center gap-1">
                <a href="/" className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">
                  Search
                </a>
                <a href="/leads" className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">
                  All Leads
                </a>
                <a href="/history" className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors">
                  History
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                localhost:8000
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Backend connected"/>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
