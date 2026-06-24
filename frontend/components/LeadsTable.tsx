"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Lead, LeadStatus } from "@/lib/types";

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

  const startEditNotes = (lead: Lead) => {
    setEditingId(lead.id);
    setNotesValue(lead.notes ?? "");
  };

  const saveNotes = async (lead: Lead) => {
    const updated = await api.leads.update(lead.id, { notes: notesValue });
    onLeadUpdated(updated);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => api.leads.exportCsv(jobId)}
        >
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => api.leads.exportXlsx(jobId)}
        >
          Export Excel
        </Button>
        <span className="text-sm text-gray-400 self-center">
          {leads.length} lead{leads.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {[
                "Business",
                "Category",
                "Phone",
                "Email",
                "Rating",
                "Reviews",
                "Size",
                "Website",
                "Status",
                "Notes",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                {/* Business name — links to Google Maps */}
                <td className="px-3 py-2 max-w-[180px]">
                  {lead.google_maps_url ? (
                    <a
                      href={lead.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium truncate block"
                    >
                      {lead.business_name}
                    </a>
                  ) : (
                    <span className="font-medium truncate block">
                      {lead.business_name}
                    </span>
                  )}
                </td>

                {/* Category */}
                <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">
                  {lead.category ?? "—"}
                </td>

                {/* Phone */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {lead.phone ?? <span className="text-gray-300">—</span>}
                </td>

                {/* Email */}
                <td className="px-3 py-2">
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Rating */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {lead.rating != null ? (
                    <span className="font-medium">{lead.rating.toFixed(1)} ⭐</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Reviews */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {lead.review_count != null
                    ? lead.review_count.toLocaleString()
                    : <span className="text-gray-300">—</span>}
                </td>

                {/* Size tier */}
                <td className="px-3 py-2 capitalize text-gray-500">
                  {lead.business_size_tier ?? "—"}
                </td>

                {/* Website */}
                <td className="px-3 py-2 max-w-[140px]">
                  {lead.website ? (
                    <a
                      href={
                        lead.website.startsWith("http")
                          ? lead.website
                          : `https://${lead.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline truncate block text-xs"
                    >
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-3 py-2">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      updateStatus(lead, e.target.value as LeadStatus)
                    }
                    className="text-xs border rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {(["new", "contacted", "qualified", "rejected"] as LeadStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                </td>

                {/* Notes */}
                <td className="px-3 py-2 max-w-[200px]">
                  {editingId === lead.id ? (
                    <div className="flex gap-1 items-center">
                      <Input
                        className="h-7 text-xs py-0"
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveNotes(lead);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => saveNotes(lead)}
                      >
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-600 transition-colors block truncate"
                      onClick={() => startEditNotes(lead)}
                      title={lead.notes ?? "Click to add note"}
                    >
                      {lead.notes ? (
                        lead.notes
                      ) : (
                        <span className="text-gray-300 text-xs italic">
                          add note
                        </span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No leads found. Start a new search to collect leads.
          </div>
        )}
      </div>
    </div>
  );
}
