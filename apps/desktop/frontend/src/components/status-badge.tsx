import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

// StatusBadge maps a status string to a coloured pill. Defaults cover
// the common cases (paid, pending, overdue, draft, active, etc).
// Apps extend the map via setStatusVariants({...}).

export type StatusVariant = "success" | "warning" | "danger" | "info" | "muted" | "accent";

const DEFAULT_MAP: Record<string, StatusVariant> = {
  // success — done / good state
  paid: "success",
  active: "success",
  completed: "success",
  approved: "success",
  delivered: "success",
  resolved: "success",
  // warning — needs attention but not broken
  pending: "warning",
  partial: "warning",
  processing: "warning",
  in_review: "warning",
  // danger — bad state
  overdue: "danger",
  cancelled: "danger",
  failed: "danger",
  rejected: "danger",
  expired: "danger",
  // muted — neutral / archived
  draft: "muted",
  archived: "muted",
  inactive: "muted",
  closed: "muted",
  // accent — informational, in-flight
  checked_in: "accent",
  in_progress: "accent",
  scheduled: "accent",
  new: "accent",
};

let statusMap: Record<string, StatusVariant> = { ...DEFAULT_MAP };

// setStatusVariants extends or overrides the global status map. Call
// once at app boot from main.tsx if you have domain-specific statuses.
export function setStatusVariants(extra: Record<string, StatusVariant>) {
  statusMap = { ...statusMap, ...Object.fromEntries(
    Object.entries(extra).map(([k, v]) => [k.toLowerCase(), v]),
  ) };
}

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger:  "bg-danger/15 text-danger",
  info:    "bg-info/15 text-info",
  muted:   "bg-surface-2 text-foreground-muted",
  accent:  "bg-accent/15 text-accent",
};

interface StatusBadgeProps {
  status: string | null | undefined;
  // Override: pass a variant to ignore the map and use this colour.
  variant?: StatusVariant;
  // Override the rendered label (defaults to humanize(status)).
  label?: string;
  className?: string;
}

export function StatusBadge({ status, variant, label, className }: StatusBadgeProps) {
  const v: StatusVariant =
    variant || statusMap[(status || "").toLowerCase()] || "muted";
  const text = label ?? humanize(status);
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium",
        VARIANT_CLASSES[v],
        className,
      )}
    >
      {text || "—"}
    </span>
  );
}
