import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Flag, AlertTriangle, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemStat, SectionCard, EmptyState, relTime } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/activity")({
  component: SystemActivityPage,
});

interface Row {
  id: string; action: string; severity: "info" | "warn" | "critical";
  summary: string; ip_address: string; user_id?: string; created_at: string;
}

const dot: Record<Row["severity"], string> = { info: "bg-info", warn: "bg-warning", critical: "bg-danger" };
const TABS = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Flagged" },
  { key: "critical", label: "Critical" },
] as const;

function SystemActivityPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");

  const stats = useQuery({
    queryKey: ["system", "activity-stats"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: { info: number; warn: number; critical: number; total: number } }>("/user-activity/stats");
        return data.data;
      } catch { return { info: 0, warn: 0, critical: 0, total: 0 }; }
    },
    refetchInterval: 60_000,
  });

  const feed = useQuery<Row[]>({
    queryKey: ["system", "activity-feed"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: Row[] }>("/user-activity?page_size=200");
        return data.data ?? [];
      } catch { return []; }
    },
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (feed.data ?? []).filter((r) => {
      if (tab === "flagged" && r.severity === "info") return false;
      if (tab === "critical" && r.severity !== "critical") return false;
      if (q && !(r.summary + " " + r.action).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feed.data, tab, search]);

  const activeUsers = useMemo(
    () => new Set((feed.data ?? []).map((r) => r.user_id).filter(Boolean)).size,
    [feed.data],
  );

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Audit log across the platform"
        actions={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-56 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SystemStat label="Events" value={stats.data?.total ?? 0} icon={Activity} />
        <SystemStat label="Flagged" value={(stats.data?.warn ?? 0) + (stats.data?.critical ?? 0)} icon={Flag} tone="warning" />
        <SystemStat label="Critical" value={stats.data?.critical ?? 0} icon={AlertTriangle} tone="danger" />
        <SystemStat label="Active users" value={activeUsers} icon={Users} tone="info" />
      </div>

      <div className="mt-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors " +
              (tab === t.key ? "bg-accent/10 text-accent" : "text-foreground-secondary hover:bg-surface-hover")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <SectionCard title="Recent events" description={rows.length + " event" + (rows.length === 1 ? "" : "s")}>
          {feed.isLoading ? (
            <div className="px-5 py-12 text-center text-[13px] text-foreground-muted">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet." hint="Events will appear here as they happen." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3 text-[13px]">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full">
                    <span className={"block h-full w-full rounded-full " + dot[r.severity]} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{r.summary}</p>
                    <p className="text-xs text-foreground-muted">
                      <code className="font-mono">{r.action}</code>
                      {r.ip_address && <span>{" · "}{r.ip_address === "::1" || r.ip_address === "127.0.0.1" ? "localhost" : r.ip_address}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-foreground-muted">{relTime(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
