"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle, Clock, Trash2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { SearchJob } from "@/lib/types";

const STATUS_ICON: Record<string, React.ReactNode> = {
  done:    <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  running: <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />,
  pending: <Clock className="w-4 h-4 text-slate-400" />,
  failed:  <AlertCircle className="w-4 h-4 text-red-500" />,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function FilterTag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded-md">
      {label}
    </span>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.jobs.list()
      .then((data) => { setJobs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (job: SearchJob) => {
    if (!confirm(`Delete "${job.keyword} in ${job.location}" and all its leads?`)) return;
    setDeletingId(job.id);
    try {
      await api.jobs.delete(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Scrape History</h1>
          <p className="text-sm text-slate-400 mt-0.5">{jobs.length} job{jobs.length !== 1 ? "s" : ""} total</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="text-sm font-medium text-white bg-[#0369A1] hover:bg-sky-700 px-3 py-1.5 rounded-lg transition-colors">
          + New Search
        </button>
      </div>

      {loading && <div className="py-20 text-center text-slate-400 text-sm">Loading...</div>}

      {!loading && jobs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">No scrape jobs yet</p>
          <p className="text-xs text-slate-400 mt-1">Start your first search to see history here</p>
          <button onClick={() => router.push("/")}
            className="mt-4 text-sm text-sky-600 hover:text-sky-800 font-medium">
            Start searching →
          </button>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((job) => {
          const filters = job.filters as Record<string, unknown>;
          const filterTags: string[] = [];
          if (filters.min_rating) filterTags.push(`${filters.min_rating}+ stars`);
          if (filters.has_website) filterTags.push("Has website");
          if (filters.has_phone) filterTags.push("Has phone");
          if (filters.min_reviews) filterTags.push(`${filters.min_reviews}+ reviews`);
          if (Array.isArray(filters.business_size_tiers) && filters.business_size_tiers.length)
            filterTags.push((filters.business_size_tiers as string[]).join(", "));

          return (
            <div key={job.id}
              className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-5 hover:border-slate-300 hover:shadow-sm transition-all group">
              <div className="shrink-0">
                {STATUS_ICON[job.status] ?? STATUS_ICON.pending}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{job.keyword}</span>
                  <span className="text-slate-400 text-sm">in</span>
                  <span className="font-medium text-slate-900">{job.location}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-slate-400 font-mono">
                    {job.total_scraped} leads · {formatDate(job.created_at)}
                  </span>
                  {filterTags.map((t) => <FilterTag key={t} label={t} />)}
                </div>
                {job.error_message && (
                  <p className="text-xs text-red-400 mt-1 truncate">{job.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => router.push(`/leads?job_id=${job.id}`)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors">
                  <ExternalLink className="w-3 h-3" /> View Leads
                </button>
                <button
                  onClick={() => handleDelete(job)}
                  disabled={deletingId === job.id}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
