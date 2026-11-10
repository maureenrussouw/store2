import { forwardRef } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// DateField wraps a native <input type="date"> with the standard
// label/hint/error chrome. We use the native picker on purpose — it's
// the only one with reliable accessibility, RTL, and i18n.
//
// Value is a YYYY-MM-DD string (the format <input type="date"> emits).
// Empty string = no date selected.
interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ value, onChange, label, hint, error, required, disabled, min, max, className }, ref) => (
    <div className={cn("block space-y-1", className)}>
      {label && (
        <span className="block text-[12.5px] font-medium text-foreground-secondary">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
        <input
          ref={ref}
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-surface text-[13.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-surface-2 disabled:text-foreground-muted"
        />
      </div>
      {error ? (
        <span className="block text-[11.5px] text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-[11.5px] text-foreground-muted">{hint}</span>
      ) : null}
    </div>
  ),
);
DateField.displayName = "DateField";

// ─── DateRangeFilter ───────────────────────────────────────────────

export interface DateRange {
  from: string; // YYYY-MM-DD or ""
  to: string;   // YYYY-MM-DD or ""
}

export type DatePreset =
  | "today"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "last90"
  | "thisYear"
  | "all"
  | "custom";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7" },
  { key: "last30", label: "Last 30" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "last90", label: "Last 90" },
  { key: "thisYear", label: "This year" },
  { key: "all", label: "All" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// presetRange returns { from, to } ISO strings for a named preset.
// "all" returns empty strings ⇒ filter not applied.
export function presetRange(preset: DatePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: isoDate(today), to: isoDate(today) };
    case "last7": {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return { from: isoDate(from), to: isoDate(today) };
    }
    case "last30": {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from: isoDate(from), to: isoDate(today) };
    }
    case "thisMonth": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: isoDate(from), to: isoDate(today) };
    }
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0); // day 0 = last of prev month
      return { from: isoDate(from), to: isoDate(to) };
    }
    case "last90": {
      const from = new Date(today);
      from.setDate(today.getDate() - 89);
      return { from: isoDate(from), to: isoDate(today) };
    }
    case "thisYear": {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: isoDate(from), to: isoDate(today) };
    }
    case "all":
    default:
      return { from: "", to: "" };
  }
}

// matchesPreset works out which preset (if any) the current value
// corresponds to. Lets the chip bar highlight the right preset when
// the parent feeds in a known range.
function matchesPreset(value: DateRange): DatePreset {
  for (const p of PRESETS) {
    const r = presetRange(p.key);
    if (r.from === value.from && r.to === value.to) return p.key;
  }
  return "custom";
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const active = matchesPreset(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const isActive = active === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(presetRange(p.key))}
            className={cn(
              "h-7 px-2.5 rounded-full text-[12px] font-medium border transition-colors",
              isActive
                ? "bg-accent/15 border-accent/30 text-accent"
                : "bg-surface border-border text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        );
      })}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="h-7 px-2 rounded-md border border-border bg-surface text-[12px] text-foreground"
        />
        <span className="text-[11px] text-foreground-muted">to</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="h-7 px-2 rounded-md border border-border bg-surface text-[12px] text-foreground"
        />
      </div>
    </div>
  );
}
