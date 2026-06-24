"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/LeadsTable";
import { api } from "@/lib/api";
import { Lead } from "@/lib/types";

function LeadsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job_id") ?? undefined;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.leads
      .list({ job_id: jobId })
      .then((data) => {
        setLeads(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [jobId]);

  const handleUpdated = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            {jobId && (
              <p className="text-sm text-gray-400">Filtered by scrape job</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              New Search
            </Button>
            <Button variant="outline" onClick={() => router.push("/history")}>
              History
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400">Loading leads...</div>
        )}
        {error && (
          <div className="text-center py-12 text-red-500">Error: {error}</div>
        )}
        {!loading && !error && (
          <LeadsTable leads={leads} jobId={jobId} onLeadUpdated={handleUpdated} />
        )}
      </div>
    </main>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
