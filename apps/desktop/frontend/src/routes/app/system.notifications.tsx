import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, relTime } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/notifications")({
  component: SystemNotificationsPage,
});

interface Notification {
  id: string; source: "sentinel" | "pulse" | "system";
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string; body: string; count?: number; read_at?: string | null; created_at: string;
}

const sevTone: Record<Notification["severity"], string> = {
  critical: "bg-danger/10 text-danger",
  high: "bg-danger/10 text-danger",
  medium: "bg-warning/10 text-warning",
  low: "bg-info/10 text-info",
  info: "bg-accent/10 text-accent",
};

function SystemNotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Notification[]; unread: number }>({
    queryKey: ["system", "notifications"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: Notification[]; unread: number }>("/notifications");
        return { data: data.data ?? [], unread: data.unread ?? 0 };
      } catch { return { data: [], unread: 0 }; }
    },
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => apiClient.post("/notifications/" + id + "/read"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "notifications"] }),
  });

  const items = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System & security alerts"
        actions={
          (data?.unread ?? 0) > 0 ? (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="mt-6 rounded-xl border border-border bg-surface">
        {isLoading ? (
          <div className="px-5 py-12 text-center text-[13px] text-foreground-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up." hint="New alerts will show up here." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.read_at && markOne.mutate(n.id)}
                className={
                  "flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-hover " +
                  (!n.read_at ? "bg-accent/5" : "")
                }
              >
                <span className={"mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg " + sevTone[n.severity]}>
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-foreground">{n.title}</p>
                    {(n.count ?? 0) > 1 && <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-foreground-muted">×{n.count}</span>}
                  </div>
                  <p className="truncate text-[12px] text-foreground-secondary">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-foreground-muted">{n.source} · {relTime(n.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
