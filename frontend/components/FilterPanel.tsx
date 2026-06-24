"use client";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Filters, BusinessSize } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const SIZES: BusinessSize[] = ["small", "medium", "large"];

export function FilterPanel({ filters, onChange }: Props) {
  const toggleSize = (size: BusinessSize) => {
    const current = filters.business_size_tiers ?? [];
    const next = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ ...filters, business_size_tiers: next.length ? next : undefined });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold text-sm text-gray-700">Filters</h3>

      <div className="space-y-1">
        <span className="text-xs text-gray-600">
          Min Rating: {filters.min_rating ?? 1.0}
        </span>
        <Slider
          min={1}
          max={5}
          step={0.5}
          value={[filters.min_rating ?? 1.0]}
          onValueChange={(v) => {
            const val = Array.isArray(v) ? v[0] : (v as number);
            onChange({ ...filters, min_rating: val === 1.0 ? undefined : val });
          }}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Min Reviews</label>
          <Input
            type="number"
            placeholder="Any"
            value={filters.min_reviews ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                min_reviews: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Max Reviews</label>
          <Input
            type="number"
            placeholder="Any"
            value={filters.max_reviews ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                max_reviews: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-600">Business Size</label>
        <div className="flex gap-4 mt-1">
          {SIZES.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <Checkbox
                id={`size-${s}`}
                checked={(filters.business_size_tiers ?? []).includes(s)}
                onCheckedChange={() => toggleSize(s)}
              />
              <label
                htmlFor={`size-${s}`}
                className="capitalize text-sm cursor-pointer"
              >
                {s}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Small &lt;50 reviews · Medium 50–500 · Large 500+
        </p>
      </div>

      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has-website"
            checked={!!filters.has_website}
            onCheckedChange={(v) =>
              onChange({ ...filters, has_website: v ? true : undefined })
            }
          />
          <label htmlFor="has-website" className="text-sm cursor-pointer">
            Has Website
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="has-phone"
            checked={!!filters.has_phone}
            onCheckedChange={(v) =>
              onChange({ ...filters, has_phone: v ? true : undefined })
            }
          />
          <label htmlFor="has-phone" className="text-sm cursor-pointer">
            Has Phone
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-600">Keyword in Name</label>
        <Input
          placeholder="e.g. plumbing"
          value={filters.keywords_in_name ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              keywords_in_name: e.target.value || undefined,
            })
          }
        />
      </div>
    </div>
  );
}
