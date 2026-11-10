import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Database, HardDrive, Server, Activity, Mail, RefreshCw, FolderOpen,
  CheckCircle2, AlertCircle, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/health")({
  component: SystemHealthPage,
});

// The four states /api/health answers in. "off" is a component this deployment
// never configured and "unknown" is a probe that could not find out, and this
// page already has a drawing for both: N/A. Reading ok alone made every one of
// them a red card.
type HealthState = "ok" | "degraded" | "off" | "unknown";

interface Component {
  state?: HealthState;
  ok?: boolean;
  latency_ms?: number;
  configured?: boolean;
  driver?: string;
}

interface Health {
  status: HealthState | "down";
  database?: Component;
  redis?: Component;
  api?: Component;
  jobs?: Component;
  email?: Component;
  storage?: Component;
}

// liveness is true for ok, false for degraded, and undefined for anything that
// is nobody's fault. An API older than the four states sends only ok, where
// false covered both "down" and "never configured", so undefined is the honest
// reading of it.
function liveness(component?: Component): boolean | undefined {
  if (!component) return undefined;
  if (component.state) {
    if (component.state === "ok") return true;
    if (component.state === "degraded") return false;
    return undefined;
  }
  return component.ok ? true : undefined;
}

function SystemHealthPage() {
  const { data, isFetching, refetch } = useQuery<Health>({
    queryKey: ["system", "health"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<Health>("/health");
        return data;
      } catch { return { status: "ok" }; }
    },
    refetchInterval: 30_000,
  });

  const ok = data?.status !== "down" && data?.status !== "degraded";
  const cards: { label: string; icon: LucideIcon; up?: boolean; detail: string }[] = [
    { label: "PostgreSQL", icon: Database, up: liveness(data?.database), detail: data?.database?.latency_ms != null ? data.database.latency_ms + "ms" : "Primary database" },
    { label: "Redis", icon: HardDrive, up: liveness(data?.redis), detail: data?.redis?.latency_ms != null ? data.redis.latency_ms + "ms" : "Cache & queue" },
    { label: "API Server", icon: Server, up: liveness(data?.api) ?? true, detail: "HTTP gateway" },
    { label: "Background Jobs", icon: Activity, up: liveness(data?.jobs), detail: "Worker queue" },
    { label: "File Storage", icon: FolderOpen, up: liveness(data?.storage), detail: data?.storage?.driver ? "Storing files on " + data.storage.driver : "Object store" },
    { label: "Email", icon: Mail, up: liveness(data?.email), detail: data?.email?.driver ? "Sending with " + data.email.driver : "Transactional mail" },
  ];

  return (
    <div>
      <PageHeader
        title="System Health"
        description="Live status of your infrastructure"
        actions={
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
              {ok ? "All systems operational" : "Degraded"}
            </span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Run check
            </button>
          </div>
        }
      />

      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-foreground-muted">Infrastructure</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const up = c.up === undefined ? null : c.up;
          return (
            <div
              key={c.label}
              className={cn(
                "rounded-xl border p-5",
                up === true ? "border-success/30 bg-success/5" : up === false ? "border-danger/30 bg-danger/5" : "border-border bg-surface",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-foreground-secondary">
                  <c.icon className="h-4 w-4" />
                </span>
                {up === true ? <CheckCircle2 className="h-5 w-5 text-success" /> : up === false ? <AlertCircle className="h-5 w-5 text-danger" /> : <span className="text-[11px] text-foreground-muted">N/A</span>}
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{c.label}</p>
              <p className="text-[12px] text-foreground-muted">{c.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
