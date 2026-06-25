"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { Group } from "@/lib/types";

const PRESET_COLORS = [
  "#0369A1", "#0891B2", "#059669", "#D97706",
  "#DC2626", "#7C3AED", "#DB2777", "#64748B",
];

interface Props {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onGroupsChanged: (groups: Group[]) => void;
  totalLeadCount: number;
}

export function GroupsSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  onGroupsChanged,
  totalLeadCount,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const group = await api.groups.create(newName.trim(), newColor);
    onGroupsChanged([...groups, group]);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
  };

  const handleDelete = async (group: Group) => {
    if (!confirm(`Delete group "${group.name}"? Leads will not be deleted.`)) return;
    await api.groups.delete(group.id);
    onGroupsChanged(groups.filter((g) => g.id !== group.id));
    if (selectedGroupId === group.id) onSelectGroup(null);
  };

  const handleRename = async (group: Group) => {
    if (!editName.trim()) return;
    const updated = await api.groups.update(group.id, { name: editName.trim() });
    onGroupsChanged(groups.map((g) => (g.id === group.id ? { ...g, name: updated.name } : g)));
    setEditingId(null);
  };

  return (
    <div className="w-52 shrink-0">
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Groups
        </span>
        <button
          onClick={() => setCreating(true)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          title="New group"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-0.5">
        {/* All Leads */}
        <button
          onClick={() => onSelectGroup(null)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedGroupId === null
              ? "bg-slate-100 text-slate-900 font-medium"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>All Leads</span>
          <span className="text-xs text-slate-400 font-mono">{totalLeadCount}</span>
        </button>

        {/* Group list */}
        {groups.map((group) => (
          <div key={group.id} className="group/item relative">
            {editingId === group.id ? (
              <div className="flex items-center gap-1 px-2 py-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <input
                  autoFocus
                  className="flex-1 text-sm border border-sky-300 rounded px-1.5 py-0.5 focus:outline-none min-w-0"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(group);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button
                  onClick={() => handleRename(group)}
                  className="p-0.5 text-emerald-600 hover:text-emerald-800"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  onSelectGroup(selectedGroupId === group.id ? null : group.id)
                }
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedGroupId === group.id
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="truncate">{group.name}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0 ml-1">
                  {group.lead_count}
                </span>
              </button>
            )}

            {editingId !== group.id && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/item:flex items-center gap-0.5 bg-white rounded-md shadow-sm border border-slate-100 px-1 py-0.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(group.id);
                    setEditName(group.name);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(group);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create form */}
      {creating && (
        <div className="mt-2 border border-slate-200 rounded-lg p-3 space-y-2.5 bg-white shadow-sm">
          <input
            autoFocus
            placeholder="Group name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-300"
          />
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  newColor === c
                    ? "scale-125 ring-2 ring-offset-1 ring-slate-400"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 text-xs py-1.5 bg-[#0369A1] text-white rounded-md hover:bg-sky-700 disabled:opacity-40 transition-colors font-medium"
            >
              Create
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
