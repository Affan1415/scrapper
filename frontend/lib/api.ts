const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  jobs: {
    create: (keyword: string, location: string, filters: object, concurrency = 5) =>
      apiFetch<import("./types").SearchJob>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ keyword, location, filters, concurrency }),
      }),
    list: () => apiFetch<import("./types").SearchJob[]>("/api/jobs"),
    get: (id: string) =>
      apiFetch<import("./types").SearchJob>(`/api/jobs/${id}`),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/jobs/${id}`, { method: "DELETE" }),
  },
  leads: {
    list: (params?: { job_id?: string; status?: string; group_id?: string }) => {
      const qs = params
        ? new URLSearchParams(
            Object.fromEntries(
              Object.entries(params).filter(([, v]) => v !== undefined)
            ) as Record<string, string>
          ).toString()
        : "";
      return apiFetch<import("./types").Lead[]>(
        `/api/leads${qs ? "?" + qs : ""}`
      );
    },
    update: (id: string, data: { status?: string; notes?: string }) =>
      apiFetch<import("./types").Lead>(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/leads/${id}`, { method: "DELETE" }),
    exportCsv: (jobId?: string) => {
      const qs = jobId ? `?job_id=${jobId}` : "";
      window.open(`${BASE_URL}/api/leads/export/csv${qs}`);
    },
    exportXlsx: (jobId?: string) => {
      const qs = jobId ? `?job_id=${jobId}` : "";
      window.open(`${BASE_URL}/api/leads/export/xlsx${qs}`);
    },
  },
  sheets: {
    status: () =>
      apiFetch<import("./types").SheetStatus>("/api/sheets/status"),
    inputRows: () =>
      apiFetch<import("./types").SheetRow[]>("/api/sheets/input-rows"),
    inputRowsGrouped: () =>
      apiFetch<import("./types").SheetGroupedRow[]>("/api/sheets/input-rows/grouped"),
    import: (skipDone = true, parallelJobs = 10) =>
      apiFetch<import("./types").ImportResponse>(
        `/api/sheets/import?skip_done=${skipDone}&parallel_jobs=${parallelJobs}`,
        { method: "POST" }
      ),
  },
  groups: {
    list: () => apiFetch<import("./types").Group[]>("/api/groups"),
    create: (name: string, color: string) =>
      apiFetch<import("./types").Group>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name, color }),
      }),
    update: (id: string, data: { name?: string; color?: string }) =>
      apiFetch<import("./types").Group>(`/api/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/groups/${id}`, { method: "DELETE" }),
    addLead: (groupId: string, leadId: string) =>
      apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/leads/${leadId}`, {
        method: "POST",
      }),
    removeLead: (groupId: string, leadId: string) =>
      apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/leads/${leadId}`, {
        method: "DELETE",
      }),
  },
};
