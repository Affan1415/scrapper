"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { FilterPanel } from "@/components/FilterPanel";
import { api } from "@/lib/api";
import { Filters, SearchJob } from "@/lib/types";

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const job = await api.jobs.get(jobId);
        setActiveJob(job);
        if (job.status === "done" || job.status === "failed") {
          stopPolling();
          if (job.status === "done") setTimeout(() => router.push(`/leads?job_id=${jobId}`), 1000);
        }
      } catch { stopPolling(); }
    }, 2000);
  };

  const handleStart = async () => {
    if (!keyword.trim() || !location.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const job = await api.jobs.create(keyword.trim(), location.trim(), filters);
      setActiveJob(job);
      startPolling(job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start scrape");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => stopPolling(), []);

  const isRunning = activeJob?.status === "running" || activeJob?.status === "pending";
  const progress = activeJob && activeJob.total_found > 0
    ? Math.round((activeJob.total_scraped / activeJob.total_found) * 100)
    : 0;

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)).length;

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">New Search</h1>
          <p className="text-sm text-slate-500 mt-1">Extract leads from Google Maps with email enrichment</p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Business type (e.g. dentists, coffee shops, plumbers)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-all"
              />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <input
                type="text"
                placeholder="Location (e.g. Austin, TX)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-all"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-sky-100 text-sky-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {activeFilterCount}
                </span>
              )}
              <svg className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>

            {showFilters && (
              <div className="border-t border-slate-100 pt-4">
                <FilterPanel filters={filters} onChange={setFilters} />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={loading || isRunning || !keyword.trim() || !location.trim()}
              className="w-full py-2.5 px-4 bg-[#0369A1] hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
              ) : isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Scraping in progress...</>
              ) : (
                <><Search className="w-4 h-4" /> Start Scraping</>
              )}
            </button>
          </div>

          {/* Progress Section */}
          {activeJob && (
            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {activeJob.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : activeJob.status === "failed" ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                  )}
                  <span className="text-sm font-medium text-slate-700">
                    {activeJob.keyword} in {activeJob.location}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {activeJob.total_scraped} / {activeJob.total_found} leads
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {activeJob.status === "done" && (
                <p className="text-xs text-emerald-600 mt-2">Done — redirecting to leads...</p>
              )}
              {activeJob.status === "failed" && activeJob.error_message && (
                <p className="text-xs text-red-500 mt-2">{activeJob.error_message}</p>
              )}
            </div>
          )}
        </div>

        {/* Quick tips */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Coffee shops", loc: "Austin, TX" },
            { label: "Dentists", loc: "New York, NY" },
            { label: "Plumbers", loc: "Los Angeles, CA" },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => { setKeyword(t.label); setLocation(t.loc); }}
              className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-sky-300 hover:bg-sky-50 transition-all group"
            >
              <p className="text-xs font-medium text-slate-700 group-hover:text-sky-700">{t.label}</p>
              <p className="text-xs text-slate-400">{t.loc}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
