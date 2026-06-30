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
                <a href="/sheets" className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/>
                    <line x1="8" y1="17" x2="16" y2="17"/>
                    <line x1="8" y1="9" x2="10" y2="9"/>
                  </svg>
                  Sheets
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">localhost:8000</span>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Backend connected"/>
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
