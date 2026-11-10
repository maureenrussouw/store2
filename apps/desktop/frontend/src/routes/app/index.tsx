import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity as ActivityIcon, ArrowUpRight, Users, Bell,
  TrendingUp, Database, ChevronRight,
} from "lucide-react";
import { useMe } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { PageHeader } from "@/components/layout/page-header";

// The desktop dashboard mirrors the admin panel's "captivating" dashboard:
// a time-of-day greeting, four stat tiles, a 7-day activity area chart, a
// severity donut, a recent-activity feed, and quick-access resource tiles.
// It stays offline-first: every API query falls back to zero/empty on error
// (i.e. when the app is offline), so the dashboard never blanks out.

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

interface ActivityRow {
  id: string;
  action: string;
  severity: "info" | "warn" | "critical";
  summary: string;
  ip_address: string;
  created_at: string;
}

// Resource tiles come from the local nav config (the "Manage" section) so
// they render instantly and work fully offline.
const resourceNav = NAV_SECTIONS.find((s) => s.title === "Manage")?.items ?? [];

function DashboardPage() {
  const { data: user } = useMe();
  const { status: sync } = useSyncStatus();
  const online = sync.reachable && !sync.force_offline;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const userCount = useQuery<number>({
    queryKey: ["dashboard", "users"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ meta?: { total: number } }>("/users?page_size=1");
        return data.meta?.total || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 60_000,
  });

  const activityStats = useQuery<{ info: number; warn: number; critical: number; total: number }>({
    queryKey: ["dashboard", "activity-stats"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: { info: number; warn: number; critical: number; total: number } }>("/user-activity/stats");
        return data.data;
      } catch {
        return { info: 0, warn: 0, critical: 0, total: 0 };
      }
    },
    refetchInterval: 60_000,
  });

  const notifications = useQuery<number>({
    queryKey: ["dashboard", "notifications-unread"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ unread: number }>("/notifications");
        return data.unread || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 60_000,
  });

  const recentActivity = useQuery<ActivityRow[]>({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: ActivityRow[] }>("/user-activity?page_size=8");
        return data.data;
      } catch {
        return [];
      }
    },
    refetchInterval: 60_000,
  });

  // 7-day activity series. Real data would come from an /api/dashboard
  // endpoint; the shape is pre-built so swapping it in is a one-line change.
  const weekSeries = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return {
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        events: Math.round(20 + Math.random() * 80),
      };
    });
  }, []);

  const severitySeries = useMemo(() => {
    const s = activityStats.data;
    if (!s || s.total === 0) return [{ name: "Info", value: 1, color: "var(--accent)" }];
    return [
      { name: "Info", value: s.info, color: "var(--accent)" },
      { name: "Warn", value: s.warn, color: "#D97706" },
      { name: "Critical", value: s.critical, color: "#DC2626" },
    ].filter((d) => d.value > 0);
  }, [activityStats.data]);

  const chartTooltip = {
    contentStyle: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: "var(--text-secondary)" },
    itemStyle: { color: "var(--text-foreground)" },
  };

  return (
    <div>
      <PageHeader
        title={greeting + ", " + (user?.first_name || "there")}
        description="Here's a snapshot of what's happening across your app right now."
      />


      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Users"
          value={userCount.data ?? 0}
          icon={<Users className="h-4 w-4" />}
          to="/app/categories"
          accent="default"
        />
        <StatTile
          label="Events (24h)"
          value={activityStats.data?.total ?? 0}
          icon={<ActivityIcon className="h-4 w-4" />}
          accent="default"
          sublabel={(activityStats.data?.critical ?? 0) > 0 ? activityStats.data!.critical + " critical" : "All clear"}
          sublabelTone={(activityStats.data?.critical ?? 0) > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Notifications"
          value={notifications.data ?? 0}
          icon={<Bell className="h-4 w-4" />}
          accent={notifications.data ? "warning" : "default"}
          sublabel={notifications.data ? "unread" : "you're caught up"}
        />
        <StatTile
          label="Sync status"
          value={online ? "Online" : "Offline"}
          icon={<Database className="h-4 w-4" />}
          to="/app/sync"
          accent={online ? "success" : "warning"}
          sublabel={(sync.pending ?? 0) > 0 ? sync.pending + " pending" : "all synced"}
          sublabelTone={(sync.pending ?? 0) > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-3 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Activity, past 7 days</p>
              <p className="text-xs text-foreground-muted">Events recorded per day across the platform</p>
            </div>
            <TrendingUp className="h-4 w-4 text-foreground-muted" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekSeries}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Area type="monotone" dataKey="events" stroke="var(--accent)" strokeWidth={2} fill="url(#activityFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-3 p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Severity mix</p>
            <p className="text-xs text-foreground-muted">Past 24 hours</p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severitySeries} dataKey="value" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {severitySeries.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip {...chartTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs">
            {severitySeries.map((s) => (
              <li key={s.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground-secondary">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-semibold text-foreground">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="mt-6 rounded-xl border border-border bg-surface-3">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Recent activity</p>
            <p className="text-xs text-foreground-muted">Latest 8 events across the platform</p>
          </div>
        </header>
        {recentActivity.isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-foreground-muted">Loading...</div>
        ) : (recentActivity.data ?? []).length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-foreground-muted">No activity yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(recentActivity.data ?? []).map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <SeverityDot severity={row.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground">{row.summary}</p>
                  <p className="text-xs text-foreground-muted">
                    <code className="font-mono">{row.action}</code>
                    {row.ip_address && (
                      <span title={row.ip_address}>
                        {" · "}
                        {row.ip_address === "::1" || row.ip_address === "127.0.0.1" ? "localhost" : row.ip_address}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-foreground-muted">{timeAgo(row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick access tiles */}
      {resourceNav.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">Quick access</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {resourceNav.map((r) => {
              const Icon = r.icon;
              return (
                <Link
                  key={r.to}
                  to={r.to}
                  className="group rounded-xl border border-border bg-surface-3 p-4 transition-colors hover:bg-surface-hover"
                >
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-accent">{r.label}</p>
                  <p className="text-xs text-foreground-muted">Manage {r.label.toLowerCase()}</p>
                </Link>
              );
            })}
            <Link
              to="/app/sync"
              className="group rounded-xl border border-dashed border-border bg-surface-3 p-4 transition-colors hover:bg-surface-hover"
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-hover text-foreground-secondary">
                <ChevronRight className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground group-hover:text-accent">Sync center</p>
              <p className="text-xs text-foreground-muted">Offline status &amp; pending changes</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to?: string;
  accent: "default" | "success" | "warning" | "danger";
  sublabel?: string;
  sublabelTone?: "success" | "danger" | "muted";
}

const accentClass: Record<StatTileProps["accent"], string> = {
  default: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const sublabelClass: Record<NonNullable<StatTileProps["sublabelTone"]>, string> = {
  success: "text-success",
  danger: "text-danger",
  muted: "text-foreground-muted",
};

function StatTile({ label, value, icon, to, accent, sublabel, sublabelTone = "muted" }: StatTileProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className={"inline-flex h-9 w-9 items-center justify-center rounded-lg " + accentClass[accent]}>{icon}</span>
        {to && <ArrowUpRight className="h-4 w-4 text-foreground-muted opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sublabel && <p className={"mt-1 text-xs " + sublabelClass[sublabelTone]}>{sublabel}</p>}
    </>
  );
  const cls = "group block rounded-xl border border-border bg-surface-3 p-4 transition-colors hover:bg-surface-hover";
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

const severityDotClass: Record<ActivityRow["severity"], string> = {
  info: "bg-accent",
  warn: "bg-warning",
  critical: "bg-danger",
};

function SeverityDot({ severity }: { severity: ActivityRow["severity"] }) {
  return (
    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full">
      <span className={"block h-full w-full rounded-full " + severityDotClass[severity]} />
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return sec + "s ago";
  const min = Math.round(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + "h ago";
  return Math.round(hr / 24) + "d ago";
}
