import { useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { relTime } from "@/components/system-ui";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/app/system/support/$id")({
  component: SystemSupportThreadPage,
});

interface Reply { id: string; body: string; created_at: string; author?: string }
interface Ticket {
  id: string; subject: string; description?: string; status: string;
  priority: string; created_at: string; replies?: Reply[];
}

function SystemSupportThreadPage() {
  const { id } = useParams({ from: "/app/system/support/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data, isLoading } = useQuery<Ticket | null>({
    queryKey: ["system", "ticket", id],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<{ data: Ticket }>("/tickets/" + id);
        return data.data;
      } catch { return null; }
    },
    refetchInterval: 15_000,
  });

  const reply = useMutation({
    mutationFn: () => apiClient.post("/tickets/" + id + "/reply", { body }),
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["system", "ticket", id] }); },
  });
  const setStatus = useMutation({
    mutationFn: (action: "close" | "reopen") => apiClient.patch("/tickets/" + id + "/" + action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "ticket", id] }),
  });

  if (isLoading) return <div className="text-[13px] text-foreground-muted">Loading…</div>;
  if (!data) return <div className="text-[13px] text-foreground-muted">Ticket not found (or offline).</div>;

  const closed = data.status === "closed";
  const replies = data.replies ?? [];

  return (
    <div>
      <button onClick={() => navigate({ to: "/app/system/support" })} className="mb-3 flex items-center gap-1.5 text-[13px] text-foreground-secondary hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to support
      </button>
      <PageHeader
        title={data.subject}
        description={"Priority: " + data.priority + " · " + data.status}
        actions={
          <button
            onClick={() => setStatus.mutate(closed ? "reopen" : "close")}
            className="rounded-lg border border-border px-3 py-2 text-[13px] text-foreground-secondary hover:bg-surface-hover"
          >
            {closed ? "Reopen" : "Close ticket"}
          </button>
        }
      />

      <div className="mt-6 max-w-3xl space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[13px] text-foreground">{data.description}</p>
          <p className="mt-2 text-[11px] text-foreground-muted">Opened {relTime(data.created_at)}</p>
        </div>
        {replies.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-[13px] text-foreground">{r.body}</p>
            <p className="mt-2 text-[11px] text-foreground-muted">{r.author ?? "Reply"} · {relTime(r.created_at)}</p>
          </div>
        ))}

        {!closed && (
          <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(); }} className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className="flex-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button type="submit" disabled={reply.isPending || !body.trim()} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
