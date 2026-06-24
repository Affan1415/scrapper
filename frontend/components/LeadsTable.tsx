"use client";
import { useState } from "react";
import { Download, FileSpreadsheet, Star, Globe, Phone, Mail, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Lead, LeadStatus } from "@/lib/types";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new:       { label: "New",       color: "bg-slate-100 text-slate-600" },
  contacted: { label: "Contacted", color: "bg-blue-50 text-blue-700" },
  qualified: { label: "Qualified", color: "bg-emerald-50 text-emerald-700" },
  rejected:  { label: "Rejected",  color: "bg-red-50 text-red-600" },
};

interface Props {
  leads: Lead[];
  jobId?: string;
  onLeadUpdated: (lead: Lead) => void;
}

export function LeadsTable({ leads, jobId, onLeadUpdated }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    const updated = await api.leads.update(lead.id, { status });
    onLeadUpdated(updated);
  };

  const saveNotes = async (lead: Lead) => {
    const updated = await api.leads.update(lead.id, { notes: notesValue });
    onLeadUpdated(updated);
    setEditingId(null);
  };

  const emailCount = leads.filter((l) => l.email).length;
  const phoneCount = leads.filter((l) => l.phone).length;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm text-slate-500">
            <span className="text-slate-900 font-semibold font-mono">{leads.length}</span> leads
          </span>
          <span className="text-sm text-slate-500">
            <span className="text-emerald-600 font-semibold font-mono">{emailCount}</span> with email
          </span>
          <span className="text-sm text-slate-500">
            <span className="text-sky-600 font-semibold font-mono">{phoneCount}</span> with phone
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => api.leads.exportCsv(jobId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => api.leads.exportXlsx(jobId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Business</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors group">
                  {/* Business */}
                  <td className="px-4 py-3">
                    <div className="max-w-[220px]">
                      {lead.google_maps_url ? (
                        <a href={lead.google_maps_url} target="_blank" rel="noreferrer"
                          className="font-medium text-slate-900 hover:text-sky-600 transition-colors block truncate">
                          {lead.business_name}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-900 block truncate">{lead.business_name}</span>
                      )}
                      {lead.category && (
                        <span className="text-xs text-slate-400 block truncate">{lead.category}</span>
                      )}
                      {lead.address && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.address}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`}
                          className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 transition-colors">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[180px]">{lead.email}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Mail className="w-3 h-3" /> No email
                        </span>
                      )}
                      {lead.phone ? (
                        <span className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="w-3 h-3 shrink-0 text-slate-400" />{lead.phone}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Phone className="w-3 h-3" /> No phone
                        </span>
                      )}
                      {lead.website && (
                        <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[140px]">{lead.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {lead.rating != null ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="font-mono text-sm font-medium text-slate-700">{lead.rating.toFixed(1)}</span>
                        </div>
                        {lead.review_count != null && (
                          <span className="text-xs text-slate-400 font-mono">{lead.review_count.toLocaleString()} reviews</span>
                        )}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Size */}
                  <td className="px-4 py-3">
                    {lead.business_size_tier ? (
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-md capitalize font-medium ${
                        lead.business_size_tier === "large" ? "bg-violet-50 text-violet-700" :
                        lead.business_size_tier === "medium" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {lead.business_size_tier}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead, e.target.value as LeadStatus)}
                      className={`text-xs px-2 py-1 rounded-md border-0 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500 ${STATUS_CONFIG[lead.status].color}`}
                    >
                      {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Notes */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {editingId === lead.id ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          className="flex-1 text-xs px-2 py-1 border border-sky-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 min-w-0"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveNotes(lead); if (e.key === "Escape") setEditingId(null); }}
                        />
                        <button onClick={() => saveNotes(lead)}
                          className="text-xs px-2 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors shrink-0">
                          ✓
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(lead.id); setNotesValue(lead.notes ?? ""); }}
                        className="text-xs text-left w-full text-slate-500 hover:text-slate-900 transition-colors truncate block"
                      >
                        {lead.notes || <span className="text-slate-300 italic">add note...</span>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leads.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No leads yet</p>
            <p className="text-xs text-slate-400 mt-1">Start a search to collect business leads</p>
          </div>
        )}
      </div>
    </div>
  );
}
