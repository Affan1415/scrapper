"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { SearchJob } from "@/lib/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  running: "secondary",
  pending: "secondary",
  failed: "destructive",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.jobs.list().then((data) => {
      setJobs(data);
      setLoading(false);
    });
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

  const handleRerun = async (job: SearchJob) => {
    const newJob = await api.jobs.create(job.keyword, job.location, job.filters);
    router.push(`/?rerun=${newJob.id}`);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Scrape History</h1>
            <p className="text-sm text-gray-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""} total</p>
          </div>
          <Button onClick={() => router.push("/")}>New Search</Button>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400">Loading history...</div>
        )}

        {!loading && jobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              No scrape jobs yet. Start your first search!
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">
                      {job.keyword}{" "}
                      <span className="text-gray-400 font-normal">in</span>{" "}
                      {job.location}
                    </p>
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {job.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {job.total_scraped} lead{job.total_scraped !== 1 ? "s" : ""} ·{" "}
                    {formatDate(job.created_at)}
                  </p>
                  {job.error_message && (
                    <p className="text-xs text-red-400 mt-0.5 truncate">
                      {job.error_message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/leads?job_id=${job.id}`)}
                  >
                    View Leads
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(job)}
                    disabled={deletingId === job.id}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingId === job.id ? "..." : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
