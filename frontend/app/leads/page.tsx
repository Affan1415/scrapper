"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { LeadsTable } from "@/components/LeadsTable";
import { GroupsSidebar } from "@/components/GroupsSidebar";
import { api } from "@/lib/api";
import { Lead, Group, SearchJob } from "@/lib/types";

function LeadsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job_id") ?? undefined;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeads = useCallback(async (groupId?: string | null) => {
    const data = await api.leads.list({ job_id: jobId, group_id: groupId ?? undefined });
    setLeads(data);
  }, [jobId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await fetchLeads(selectedGroupId); } finally { setRefreshing(false); }
  };

  // Initial load
  useEffect(() => {
    Promise.all([
      api.leads.list({ job_id: jobId }),
      api.groups.list(),
    ])
      .then(([leadsData, groupsData]) => {
        setLeads(leadsData);
        setGroups(groupsData);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [jobId]);

  // Auto-poll while job is running
  useEffect(() => {
    if (!jobId) return;
    // Fetch initial job status
    api.jobs.get(jobId).then(setActiveJob).catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const job = await api.jobs.get(jobId);
        setActiveJob(job);
        await fetchLeads(selectedGroupId);
        if (job.status === "done" || job.status === "failed") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobId, fetchLeads, selectedGroupId]);

  // Re-fetch leads when group filter changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading) return;
    fetchLeads(selectedGroupId).catch(() => {});
  }, [selectedGroupId]);

  const handleUpdated = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {selectedGroup ? selectedGroup.name : jobId ? "Job Results" : "All Leads"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {selectedGroup
              ? `${selectedGroup.lead_count} lead${selectedGroup.lead_count !== 1 ? "s" : ""} in this group`
              : jobId
              ? "Leads from this scrape job"
              : "All collected leads"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {jobId && (
            <button
              onClick={() => router.push("/leads")}
              className="text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white transition-all"
            >
              View All
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="text-sm font-medium text-white bg-[#0369A1] hover:bg-sky-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + New Search
          </button>
        </div>
      </div>

      {/* Job progress banner */}
      {jobId && activeJob && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {activeJob.status === "done" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : activeJob.status === "failed" ? (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-sky-500 animate-spin shrink-0" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {activeJob.keyword} — {activeJob.location}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                activeJob.status === "done" ? "bg-emerald-50 text-emerald-600" :
                activeJob.status === "failed" ? "bg-red-50 text-red-600" :
                "bg-sky-50 text-sky-600"
              }`}>
                {activeJob.status}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {activeJob.total_scraped} / {activeJob.total_found} leads
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                activeJob.status === "done" ? "bg-emerald-400" :
                activeJob.status === "failed" ? "bg-red-400" : "bg-sky-500"
              }`}
              style={{
                width: activeJob.total_found > 0
                  ? `${Math.round((activeJob.total_scraped / activeJob.total_found) * 100)}%`
                  : "0%"
              }}
            />
          </div>
          {activeJob.status === "failed" && activeJob.error_message && (
            <p className="text-xs text-red-500 mt-2">{activeJob.error_message}</p>
          )}
        </div>
      )}

      {/* Body: sidebar + table */}
      <div className="flex gap-6">
        <GroupsSidebar
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onGroupsChanged={setGroups}
          totalLeadCount={leads.length}
        />

        <div className="flex-1 min-w-0">
          {loading && (
            <div className="py-20 text-center text-slate-400 text-sm">Loading leads...</div>
          )}
          {error && (
            <div className="py-20 text-center text-red-500 text-sm">Error: {error}</div>
          )}
          {!loading && !error && (
            <LeadsTable
              leads={leads}
              jobId={jobId}
              allGroups={groups}
              onLeadUpdated={handleUpdated}
              onGroupsChanged={setGroups}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
