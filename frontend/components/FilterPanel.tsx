"use client";
import { Filters, BusinessSize } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const SIZES: { value: BusinessSize; label: string; desc: string }[] = [
  { value: "small", label: "Small", desc: "<50 reviews" },
  { value: "medium", label: "Medium", desc: "50–500" },
  { value: "large", label: "Large", desc: "500+" },
];

export function FilterPanel({ filters, onChange }: Props) {
  const toggleSize = (size: BusinessSize) => {
    const current = filters.business_size_tiers ?? [];
    const next = current.includes(size) ? current.filter((s) => s !== size) : [...current, size];
    onChange({ ...filters, business_size_tiers: next.length ? next : undefined });
  };

  return (
    <div className="space-y-5">
      {/* Rating */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Min Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 3.5, 4, 4.5, 5].map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...filters, min_rating: filters.min_rating === r ? undefined : r })}
              className={`px-2.5 py-1 text-xs rounded-md border transition-all font-mono ${
                filters.min_rating === r
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
              }`}
            >
              {r}+
            </button>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Review Count</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.min_reviews ?? ""}
            onChange={(e) => onChange({ ...filters, min_reviews: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
          />
          <span className="text-slate-300 text-sm">—</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.max_reviews ?? ""}
            onChange={(e) => onChange({ ...filters, max_reviews: e.target.value ? Number(e.target.value) : undefined })}
            className="w-24 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Business size */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Business Size</label>
        <div className="flex gap-2">
          {SIZES.map(({ value, label, desc }) => {
            const selected = (filters.business_size_tiers ?? []).includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleSize(value)}
                className={`flex-1 py-2 px-3 text-xs rounded-md border transition-all text-center ${
                  selected
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className={`text-[10px] mt-0.5 ${selected ? "text-sky-100" : "text-slate-400"}`}>{desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Must Have</label>
        <div className="flex gap-3">
          {[
            { key: "has_website" as const, label: "Website" },
            { key: "has_phone" as const, label: "Phone" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onChange({ ...filters, [key]: filters[key] ? undefined : true })}
              className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                filters[key]
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Keyword in name */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Keyword in Name</label>
        <input
          type="text"
          placeholder="e.g. family, 24/7, express"
          value={filters.keywords_in_name ?? ""}
          onChange={(e) => onChange({ ...filters, keywords_in_name: e.target.value || undefined })}
          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}
