"use client";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { SearchJob } from "@/lib/types";

export function RunningJobsIndicator() {
  const [activeJobs, setActiveJobs] = useState<SearchJob[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const jobs = await api.jobs.list();
        setActiveJobs(
          jobs.filter((j) => j.status === "running" || j.status === "pending")
        );
      } catch {
        // backend unreachable — silent
      }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  if (activeJobs.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {activeJobs.map((job) => {
        const pct =
          job.total_found > 0
            ? Math.round((job.total_scraped / job.total_found) * 100)
            : 0;

        return (
          <a
            key={job.id}
            href={`/?job_id=${job.id}`}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-3 py-1.5 transition-colors group"
            title={`${job.keyword} in ${job.location}`}
          >
            <Loader2 className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
            <div className="max-w-[140px]">
              <p className="text-xs text-white font-medium truncate leading-tight">
                {job.keyword}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">
                {job.location}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 ml-1">
              <span className="text-[10px] text-slate-300 font-mono whitespace-nowrap">
                {job.total_scraped}/{job.total_found}
              </span>
              <div className="w-12 h-1 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
