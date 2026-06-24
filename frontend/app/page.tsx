"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FilterPanel } from "@/components/FilterPanel";
import { api } from "@/lib/api";
import { Filters, SearchJob } from "@/lib/types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  done: "default",
  running: "secondary",
  pending: "secondary",
  failed: "destructive",
};

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const job = await api.jobs.get(jobId);
        setActiveJob(job);
        if (job.status === "done" || job.status === "failed") {
          stopPolling();
          if (job.status === "done") {
            setTimeout(() => router.push(`/leads?job_id=${jobId}`), 1200);
          }
        }
      } catch {
        stopPolling();
      }
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

  const progress =
    activeJob && activeJob.total_found > 0
      ? Math.round((activeJob.total_scraped / activeJob.total_found) * 100)
      : 0;

  const isRunning = activeJob?.status === "running" || activeJob?.status === "pending";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Google Maps Lead Scraper
          </h1>
          <p className="text-gray-500 text-sm">
            Extract business leads with email enrichment
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Input
                placeholder="Business type (e.g. dentists, coffee shops, plumbers)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
            <div className="space-y-1">
              <Input
                placeholder="Location (e.g. Austin, TX or New York, NY)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
            <FilterPanel filters={filters} onChange={setFilters} />
            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleStart}
                disabled={loading || isRunning || !keyword.trim() || !location.trim()}
                className="flex-1"
              >
                {loading
                  ? "Starting..."
                  : isRunning
                  ? "Scraping in progress..."
                  : "Start Scraping"}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/history")}
              >
                History
              </Button>
            </div>
          </CardContent>
        </Card>

        {activeJob && (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {activeJob.keyword} in {activeJob.location}
                  </p>
                  <p className="text-xs text-gray-400">
                    {activeJob.total_scraped} leads saved ·{" "}
                    {activeJob.total_found} found
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[activeJob.status] ?? "secondary"}>
                  {activeJob.status}
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
              {activeJob.status === "failed" && activeJob.error_message && (
                <p className="text-xs text-red-500">{activeJob.error_message}</p>
              )}
              {activeJob.status === "done" && (
                <p className="text-xs text-green-600">
                  Done! Redirecting to leads...
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
