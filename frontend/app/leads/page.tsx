"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LeadsTable } from "@/components/LeadsTable";
import { GroupsSidebar } from "@/components/GroupsSidebar";
import { api } from "@/lib/api";
import { Lead, Group } from "@/lib/types";

function LeadsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job_id") ?? undefined;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Re-fetch leads when group filter changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading) return;
    api.leads
      .list({
        job_id: jobId,
        group_id: selectedGroupId ?? undefined,
      })
      .then(setLeads)
      .catch(() => {});
  }, [selectedGroupId]);

  const handleUpdated = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
