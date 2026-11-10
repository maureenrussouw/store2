import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SystemStat } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/jobs")({
  component: SystemJobsPage,
});

interface JobStats { active: number; pending: number; completed: number; failed: number; retry: number }

function SystemJobsPage() {
  const { data, isError } = useQuery<JobStats | null>({
    queryKey: ["system", "jobs"],
    queryFn: async () => {
      try { const { data } = await apiClient.get<{ data: JobStats }>("/admin/jobs/stats"); return data.data; }
      catch { return null; }
    },
    refetchInterval: 15_000,
  });

  return (
    <div>
      <PageHeader title="Background Jobs" description="Async queue — email, image processing, cleanup" />

      {data ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SystemStat label="Active" value={data.active ?? 0} icon={Activity} />
          <SystemStat label="Pending" value={data.pending ?? 0} icon={Clock} tone="info" />
          <SystemStat label="Completed" value={data.completed ?? 0} icon={CheckCircle2} tone="success" />
          <SystemStat label="Failed" value={data.failed ?? 0} icon={AlertCircle} tone={(data.failed ?? 0) > 0 ? "danger" : "default"} />
          <SystemStat label="Retry" value={data.retry ?? 0} icon={RefreshCw} tone={(data.retry ?? 0) > 0 ? "warning" : "default"} />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-12 text-center">
          <p className="text-[13px] text-foreground">The job queue is unavailable.</p>
          <p className="mt-1 text-[12px] text-foreground-muted">
            {isError ? "Background jobs need Redis — start it, or check your REDIS_URL." : "Loading…"}
          </p>
        </div>
      )}
    </div>
  );
}
