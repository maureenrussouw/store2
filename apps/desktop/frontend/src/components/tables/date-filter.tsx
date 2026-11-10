import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateRange = {
  preset?: "today" | "7d" | "30d" | "month" | "custom";
  from?: string;
  to?: string;
};

const PRESETS: { key: NonNullable<DateRange["preset"]>; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
];

// rangeToBounds turns a DateRange into [fromMs, toMs] (either may be null).
export function rangeToBounds(range: DateRange): [number | null, number | null] {
  if (!range.preset) return [null, null];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (range.preset) {
    case "today":
      return [startOfDay, null];
    case "7d":
      return [now.getTime() - 7 * 864e5, null];
    case "30d":
      return [now.getTime() - 30 * 864e5, null];
    case "month":
      return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), null];
    case "custom":
      return [
        range.from ? new Date(range.from).getTime() : null,
        range.to ? new Date(range.to).getTime() + 864e5 : null,
      ];
  }
}

export function DateFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!value.preset;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const label = active
    ? (PRESETS.find((p) => p.key === value.preset)?.label ?? "Custom")
    : "Date";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
          active
            ? "border-accent bg-accent/10 text-accent"
            : "border-border bg-surface-2 text-foreground-secondary hover:text-foreground",
        )}
      >
        <Calendar className="h-4 w-4" />
        {label}
        {active ? (
          <span
            className="rounded p-0.5 hover:bg-accent/20"
            onClick={(e) => {
              e.stopPropagation();
              onChange({});
            }}
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface-3 p-3 shadow-lg">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            Quick ranges
          </p>
          <div className="space-y-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onChange({ preset: p.key });
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-[13px]",
                  value.preset === p.key ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface-hover",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            Custom
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={value.from ?? ""}
              onChange={(e) => onChange({ preset: "custom", from: e.target.value, to: value.to })}
              className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-accent"
            />
            <span className="text-foreground-muted">–</span>
            <input
              type="date"
              value={value.to ?? ""}
              onChange={(e) => onChange({ preset: "custom", from: value.from, to: e.target.value })}
              className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground outline-none focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
}
