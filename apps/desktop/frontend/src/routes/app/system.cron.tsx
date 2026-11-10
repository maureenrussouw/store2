import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard, EmptyState } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/cron")({
  component: SystemCronPage,
});

interface Task { name: string; schedule: string; type: string }

function SystemCronPage() {
  const { data = [], isLoading } = useQuery<Task[]>({
    queryKey: ["system", "cron"],
    queryFn: async () => {
      try { const { data } = await apiClient.get<{ data: Task[] }>("/admin/cron/tasks"); return data.data ?? []; }
      catch { return []; }
    },
    refetchInterval: 60_000,
  });

  return (
    <div>
      <PageHeader title="Cron Schedules" description="Recurring tasks registered with the scheduler" />
      <div className="mt-6">
        <SectionCard title="Scheduled tasks" description={data.length + " task" + (data.length === 1 ? "" : "s")}>
          {isLoading ? (
            <div className="px-5 py-12 text-center text-[13px] text-foreground-muted">Loading…</div>
          ) : data.length === 0 ? (
            <EmptyState icon={Calendar} title="No scheduled tasks." hint="Register cron tasks on the server to see them here." />
          ) : (
            <ul className="divide-y divide-border">
              {data.map((t, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                  <div>
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-[12px] text-foreground-muted">{t.type}</p>
                  </div>
                  <code className="rounded bg-surface-2 px-2 py-1 font-mono text-[12px] text-foreground-secondary">{t.schedule}</code>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
