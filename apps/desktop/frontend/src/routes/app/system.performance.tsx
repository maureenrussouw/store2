import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gauge, TrendingUp, AlertCircle, Cpu } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemStat, SectionCard, EmptyState } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/performance")({
  component: SystemPerformancePage,
});

interface Summary {
  latency?: { p50: number; p95: number; p99: number; avg: number };
  traffic?: { throughput: number; total: number };
  errors?: { rate: number; active_open: number };
  saturation?: { goroutines: number; heap_mb: number; gc_cycles: number; cpu_cores: number };
  slowest_routes?: { route: string; method: string; requests: number; avg: number; p95: number; p99: number; error_rate: number }[];
}

function SystemPerformancePage() {
  const { data } = useQuery<Summary>({
    queryKey: ["system", "performance"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data?: Summary } & Summary>("/admin/observability/summary");
        return (data.data ?? data) as Summary;
      } catch { return {}; }
    },
    refetchInterval: 30_000,
  });

  const lat = data?.latency, tr = data?.traffic, err = data?.errors, sat = data?.saturation;
  const routes = data?.slowest_routes ?? [];

  return (
    <div>
      <PageHeader title="Performance" description="Latency, traffic, errors & saturation" />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SystemStat label="P95 latency" value={lat ? Math.round(lat.p95) + "ms" : "—"} icon={Gauge} sub={lat ? "avg " + Math.round(lat.avg) + "ms" : undefined} />
        <SystemStat label="Throughput" value={tr ? (tr.throughput > 0 && tr.throughput < 10 ? tr.throughput.toFixed(2) : Math.round(tr.throughput).toLocaleString()) + "/s" : "—"} icon={TrendingUp} tone="info" sub={tr ? tr.total + " total" : undefined} />
        <SystemStat label="Error rate" value={err ? err.rate.toFixed(1) + "%" : "—"} icon={AlertCircle} tone={err && err.rate > 0 ? "danger" : "default"} sub={err ? err.active_open + " open" : undefined} />
        <SystemStat label="Goroutines" value={sat?.goroutines ?? "—"} icon={Cpu} sub={sat ? sat.heap_mb + "MB heap" : undefined} />
      </div>

      <div className="mt-6">
        <SectionCard title="Slowest routes" description="By P99 latency">
          {routes.length === 0 ? (
            <EmptyState icon={Gauge} title="No route metrics yet." hint="Metrics appear once the API serves traffic." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                    <th className="px-5 py-2.5 font-medium">Route</th>
                    <th className="px-4 py-2.5 font-medium">Reqs</th>
                    <th className="px-4 py-2.5 font-medium">Avg</th>
                    <th className="px-4 py-2.5 font-medium">P95</th>
                    <th className="px-4 py-2.5 font-medium">P99</th>
                    <th className="px-4 py-2.5 font-medium">Err</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-2.5 font-mono text-foreground">{r.method} {r.route}</td>
                      <td className="px-4 py-2.5 text-foreground-secondary">{r.requests}</td>
                      <td className="px-4 py-2.5 text-foreground-secondary">{Math.round(r.avg)}ms</td>
                      <td className="px-4 py-2.5 text-foreground-secondary">{Math.round(r.p95)}ms</td>
                      <td className="px-4 py-2.5 text-foreground-secondary">{Math.round(r.p99)}ms</td>
                      <td className={"px-4 py-2.5 " + (r.error_rate > 0 ? "text-danger" : "text-foreground-secondary")}>{r.error_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
