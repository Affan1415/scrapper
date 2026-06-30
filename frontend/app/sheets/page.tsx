"use client";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw,
  FileSpreadsheet, ArrowDownToLine, ExternalLink,
  AlertCircle, ChevronDown, ChevronRight, MapPin,
} from "lucide-react";
import { api } from "@/lib/api";
import { SheetStatus, SheetGroupedRow, ImportResponse } from "@/lib/types";

const SHEETS_BASE = "https://docs.google.com/spreadsheets/d";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "done")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Done ✓</span>;
  if (s === "running")
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
      </span>
    );
  if (s === "queued")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Queued</span>;
  return <span className="text-xs text-slate-300">Pending</span>;
}

export default function SheetsPage() {
  const [sheetStatus, setSheetStatus] = useState<SheetStatus | null>(null);
  const [groups, setGroups] = useState<SheetGroupedRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingRows, setLoadingRows] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [parallelJobs, setParallelJobs] = useState(10);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if any row is actively running/queued
  const checkRunning = (g: SheetGroupedRow[]) =>
    g.some((group) =>
      group.locations.some((l) => ["running", "queued"].includes(l.status.toLowerCase()))
    );

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchGroups = async () => {
    try {
      const data = await api.sheets.inputRowsGrouped();
      setGroups(data);
      const running = checkRunning(data);
      setIsRunning(running);
      if (!running) stopPolling();
      return data;
    } catch {
      return null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(fetchGroups, 5000);
  };

  useEffect(() => {
    api.sheets.status().then(setSheetStatus).catch(() =>
      setSheetStatus({ connected: false, input_sheet_id: "", output_sheet_id: "", error: "Backend unreachable" })
    );
    return () => stopPolling();
  }, []);

  const loadRows = async () => {
    setLoadingRows(true);
    setError(null);
    try {
      const data = await api.sheets.inputRowsGrouped();
      setGroups(data);
      setExpanded(new Set(data.map((g) => g.keyword)));
      setIsRunning(checkRunning(data));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load rows");
    } finally {
      setLoadingRows(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const result = await api.sheets.import(true, parallelJobs);
      setImportResult(result);
      if (result.imported > 0) {
        setIsRunning(true);
        // Refresh immediately to show Running status, then start polling
        await fetchGroups();
        startPolling();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const toggleExpand = (keyword: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(keyword) ? next.delete(keyword) : next.add(keyword);
      return next;
    });
  };

  const totalRows = groups.reduce((s, g) => s + g.locations.length, 0);
  const doneRows = groups.reduce((s, g) => s + g.locations.filter((l) => l.status.toLowerCase() === "done").length, 0);
  const pendingRows = groups.reduce(
    (s, g) => s + g.locations.filter((l) => !["done", "queued", "running"].includes(l.status.toLowerCase())).length, 0
  );

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Google Sheets Integration</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Processes one business type at a time across all locations — completed rows are crossed out
          </p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
            <span className="text-sm text-sky-700 font-medium">Import running — auto-updating every 5s</span>
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${
        sheetStatus?.connected ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
      }`}>
        {!sheetStatus ? (
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin mt-0.5" />
        ) : sheetStatus.connected ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-medium ${sheetStatus?.connected ? "text-emerald-800" : "text-red-700"}`}>
            {!sheetStatus ? "Checking connection..." : sheetStatus.connected ? "Connected to Google Sheets" : "Not connected"}
          </p>
          {sheetStatus && !sheetStatus.connected && (
            <p className="text-xs text-red-600 mt-0.5">
              {sheetStatus.error} — Place <code className="font-mono bg-red-100 px-1 rounded">credentials.json</code> in <code className="font-mono bg-red-100 px-1 rounded">backend/</code>
            </p>
          )}
        </div>
      </div>

      {/* Sheet cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Input */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Input Sheet</p>
                <p className="text-xs text-slate-400">Business types × Locations</p>
              </div>
            </div>
            {sheetStatus?.input_sheet_id && (
              <a href={`${SHEETS_BASE}/${sheetStatus.input_sheet_id}/edit`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-600 transition-colors">
                Open <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {groups.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-mono font-bold text-slate-700">{totalRows}</p>
                <p className="text-[10px] text-slate-400">Total</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <p className="text-lg font-mono font-bold text-amber-600">{pendingRows}</p>
                <p className="text-[10px] text-slate-400">Pending</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-lg font-mono font-bold text-emerald-600">{doneRows}</p>
                <p className="text-[10px] text-slate-400">Done</p>
              </div>
            </div>
          )}

          {/* Parallel jobs slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Parallel jobs</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">
                  {parallelJobs <= 5 ? "Conservative" : parallelJobs <= 15 ? "Balanced" : "Aggressive"}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
                  {parallelJobs}×
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={parallelJobs}
              onChange={(e) => setParallelJobs(Number(e.target.value))}
              disabled={isRunning}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] text-slate-300 font-mono">
              <span>1</span>
              <span>25</span>
              <span>50</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={loadRows} disabled={!sheetStatus?.connected || loadingRows}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loadingRows ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Preview
            </button>
            <button onClick={handleImport}
              disabled={!sheetStatus?.connected || importing || isRunning || pendingRows === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              {importing ? "Starting..." : isRunning ? "Running..." : `Import ${pendingRows > 0 ? pendingRows + " jobs" : ""}`}
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Output Sheet</p>
                <p className="text-xs text-slate-400">Scraped leads — auto-populated</p>
              </div>
            </div>
            {sheetStatus?.output_sheet_id && (
              <a href={`${SHEETS_BASE}/${sheetStatus.output_sheet_id}/edit`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                Open <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Leads are written here as each business type completes. Input sheet rows are crossed out simultaneously.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Rows are appended — existing data is never overwritten
          </div>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
            {importResult.imported} job{importResult.imported !== 1 ? "s" : ""} started
            {importResult.skipped > 0 && `, ${importResult.skipped} skipped (already done)`}
            {" — "}progress updates below every 5s
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Grouped rows */}
      {groups.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Input Sheet — Grouped by Business Type</p>
            <div className="flex items-center gap-3">
              {doneRows > 0 && (
                <span className="text-xs text-slate-400">
                  <span className="font-mono font-semibold text-emerald-600">{doneRows}</span> / {totalRows} rows done
                </span>
              )}
              <span className="text-xs text-slate-400">{groups.length} business types</span>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {groups.map((group) => {
              const isOpen = expanded.has(group.keyword);
              const groupDone = group.locations.every((l) => l.status.toLowerCase() === "done");
              const groupRunning = group.locations.some((l) => l.status.toLowerCase() === "running");
              const groupQueued = group.locations.some((l) => l.status.toLowerCase() === "queued");
              const doneCount = group.locations.filter((l) => l.status.toLowerCase() === "done").length;

              return (
                <div key={group.keyword}>
                  <button
                    onClick={() => toggleExpand(group.keyword)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${groupDone ? "bg-slate-50" : ""}`}
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                    <span className={`text-sm font-semibold flex-1 ${groupDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                      {group.keyword}
                    </span>
                    <span className="text-xs text-slate-400 font-mono mr-2">
                      {doneCount}/{group.locations.length}
                    </span>
                    {groupDone ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Done ✓</span>
                    ) : groupRunning ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Running
                      </span>
                    ) : groupQueued ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Queued</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {group.locations.length} location{group.locations.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-50">
                      {group.locations.map((loc) => {
                        const isDone = loc.status.toLowerCase() === "done";
                        const isLocRunning = loc.status.toLowerCase() === "running";
                        return (
                          <div key={loc.row}
                            className={`flex items-center gap-3 px-10 py-2.5 ${isDone ? "bg-slate-50" : isLocRunning ? "bg-sky-50/50" : ""}`}>
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${isDone ? "text-slate-300" : isLocRunning ? "text-sky-400" : "text-slate-400"}`} />
                            <span className={`text-sm flex-1 ${isDone ? "line-through text-slate-400" : "text-slate-600"}`}>
                              {loc.location}
                            </span>
                            <StatusBadge status={loc.status} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
