import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, relTime } from "@/components/system-ui";
import { ResourceDrawer } from "@/components/resource-drawer";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/support")({
  component: SystemSupportPage,
});

interface Ticket {
  id: string; subject: string; description?: string; status: string;
  priority: "low" | "medium" | "high" | "critical"; created_at: string;
  user?: { first_name?: string; last_name?: string; email?: string };
}

const prio: Record<Ticket["priority"], string> = {
  low: "bg-surface-2 text-foreground-muted",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  critical: "bg-danger/10 text-danger",
};

function SystemSupportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<Ticket["priority"]>("medium");
  const [description, setDescription] = useState("");

  const { data = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["system", "tickets", status],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: Ticket[] }>("/tickets?status=" + status);
        return data.data ?? [];
      } catch { return []; }
    },
    refetchInterval: 30_000,
  });

  const create = useMutation({
    mutationFn: () => apiClient.post<{ data: Ticket }>("/tickets", { subject, priority, description }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["system", "tickets"] });
      setOpen(false); setSubject(""); setDescription(""); setPriority("medium");
      const id = res.data?.data?.id;
      if (id) navigate({ to: "/app/system/support/$id", params: { id: String(id) } });
    },
  });

  return (
    <div>
      <PageHeader
        title="Support"
        description="Tickets & conversations"
        actions={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover">
            <Plus className="h-4 w-4" /> New ticket
          </button>
        }
      />

      <div className="mt-6 flex gap-1">
        {(["open", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={"rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-colors " + (status === s ? "bg-accent/10 text-accent" : "text-foreground-secondary hover:bg-surface-hover")}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center text-[13px] text-foreground-muted">Loading…</div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">
            <EmptyState icon={MessageSquare} title={"No " + status + " tickets."} />
          </div>
        ) : (
          data.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate({ to: "/app/system/support/$id", params: { id: String(t.id) } })}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">{t.subject}</p>
                <p className="text-[12px] text-foreground-muted">
                  {t.user ? ([t.user.first_name, t.user.last_name].filter(Boolean).join(" ") || t.user.email) : "—"} · {relTime(t.created_at)}
                </p>
              </div>
              <span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize " + prio[t.priority]}>{t.priority}</span>
            </button>
          ))
        )}
      </div>

      <ResourceDrawer open={open} title="New ticket" description="Open a support ticket" onClose={() => setOpen(false)}>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="flex h-full flex-col">
          <div className="flex-1 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Ticket["priority"])} className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover">Cancel</button>
            <button type="submit" disabled={create.isPending || !subject} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create ticket"}
            </button>
          </div>
        </form>
      </ResourceDrawer>
    </div>
  );
}
