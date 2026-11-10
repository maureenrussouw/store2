import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneChip: Record<Tone, string> = {
  default: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
};

export function SystemStat({
  label, value, icon: Icon, tone = "default", sub,
}: { label: string; value: string | number; icon: LucideIcon; tone?: Tone; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-[12px] text-foreground-muted">{sub}</p>}
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", toneChip[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function SectionCard({
  title, description, action, children,
}: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && <p className="text-xs text-foreground-muted">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto mb-3 inline-flex rounded-full bg-surface-2 p-4">
        <Icon className="h-6 w-6 text-foreground-muted" />
      </div>
      <p className="text-[13px] text-foreground">{title}</p>
      {hint && <p className="mt-1 text-[12px] text-foreground-muted">{hint}</p>}
    </div>
  );
}

export function relTime(iso: unknown): string {
  if (!iso) return "";
  const t = new Date(String(iso)).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return sec + "s ago";
  const min = Math.round(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + "h ago";
  return Math.round(hr / 24) + "d ago";
}
