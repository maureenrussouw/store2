import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  RefreshCw,
  Cloud,
  CloudOff,
  Database,
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  RotateCcw,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useSyncStatus } from "@/hooks/use-sync-status";
import {
  getPendingChanges,
  confirmChange,
  revertChange,
  revertAll,
  parseGoBytes,
  type OutboxEntry,
} from "@/lib/sync-client";

export const Route = createFileRoute("/app/sync")({ component: SyncPage });

type Tab = "overview" | "modules" | "pending" | "settings";

function relTime(iso?: string): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  return relFromMs(t);
}

// Outbox CreatedAt is unix seconds (Go nowUnix()).
function relTimeUnix(secs?: number): string {
  if (!secs) return "";
  return relFromMs(secs * 1000);
}

function relFromMs(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">{label}</div>
      <div className="mt-2 text-[18px] font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-foreground-secondary">{hint}</div>}
    </div>
  );
}

// A human label for a queued record, pulled from its payload.
function entityLabel(data: Record<string, unknown> | null, fallbackId: string): string {
  if (data) {
    for (const k of ["name", "title", "sku", "slug", "email"]) {
      const v = data[k];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return fallbackId.slice(0, 8) + "…";
}

// A short, readable summary of what a change carries — the meaningful scalar
// fields, so the user can see *what* is about to sync, not just that something is.
function fieldSummary(data: Record<string, unknown> | null): { key: string; value: string }[] {
  if (!data) return [];
  const skip = new Set(["id", "_deleted", "version", "created_at", "updated_at", "deleted_at"]);
  const out: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    let value: string;
    if (v == null) value = "—";
    else if (Array.isArray(v)) value = `${v.length} item${v.length === 1 ? "" : "s"}`;
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      value = typeof o.name === "string" ? String(o.name) : "attached";
    } else value = String(v);
    if (value.length > 60) value = value.slice(0, 57) + "…";
    out.push({ key: k, value });
  }
  return out;
}

const OP_META: Record<OutboxEntry["Op"], { label: string; icon: React.ElementType; cls: string }> = {
  create: { label: "Created", icon: Plus, cls: "bg-success/10 text-success" },
  update: { label: "Updated", icon: Pencil, cls: "bg-warning/10 text-warning" },
  delete: { label: "Deleted", icon: Trash2, cls: "bg-danger/10 text-danger" },
};

function OpBadge({ op }: { op: OutboxEntry["Op"] }) {
  const m = OP_META[op] ?? OP_META.update;
  const Icon = m.icon;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold " + m.cls}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function SyncPage() {
  const { status, busy, setOffline, setAutoSync, forceSync } = useSyncStatus();
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);

  const load = () => getPendingChanges().then(setPending).catch(() => {});

  useEffect(() => {
    let alive = true;
    const tick = () => getPendingChanges().then((p) => { if (alive) setPending(p); }).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const offline = status.force_offline;
  const autoSync = status.auto_sync;
  const syncing = status.syncing || busy;
  const tables = status.tables ?? [];
  const perModel: Record<string, number> = {};
  for (const p of pending) perModel[p.Model] = (perModel[p.Model] || 0) + 1;

  const statusText = offline ? "Working offline" : status.reachable ? "Online" : "Server unreachable";

  const doConfirm = async (p: OutboxEntry) => {
    setActing(p.ID);
    try {
      await confirmChange(p.Model, p.EntityID);
      await load();
    } finally {
      setActing(null);
    }
  };
  const doRevert = async (p: OutboxEntry) => {
    setActing(p.ID);
    try {
      await revertChange(p.Model, p.EntityID);
      await load();
    } finally {
      setActing(null);
    }
  };
  const doRevertAll = async () => {
    setActing(-1);
    try {
      await revertAll();
      await load();
      setConfirmDiscardAll(false);
    } finally {
      setActing(null);
    }
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "modules", label: "Modules" },
    { key: "pending", label: "Pending changes", badge: pending.length },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div>
      <PageHeader title="Sync" description="Status, modules, and pending changes for this device." />

      {/* Tab bar + Sync now */}
      <div className="mt-6 flex items-center justify-between border-b border-border-subtle">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors " +
                (tab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent text-foreground-secondary hover:text-foreground")
              }
            >
              {t.label}
              {t.badge ? (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="mb-2 flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
            </span>
          )}
          <button
            onClick={forceSync}
            disabled={busy || offline}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4 " + (syncing ? "animate-spin" : "")} /> Sync now
          </button>
        </div>
      </div>

      {tab === "overview" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Status"
              value={
                <span className={"flex items-center gap-2 " + (offline ? "text-warning" : status.reachable ? "text-success" : "text-danger")}>
                  {offline ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  {statusText}
                </span>
              }
              hint={autoSync ? "auto-sync on" : "auto-sync off — confirm manually"}
            />
            <StatCard
              label="Last sync"
              value={syncing ? <span className="flex items-center gap-2 text-accent"><Loader2 className="h-4 w-4 animate-spin" />Syncing…</span> : relTime(status.last_sync)}
            />
            <StatCard label="Pending changes" value={String(status.pending)} hint={status.pending === 0 ? "all synced" : "waiting to push"} />
            <StatCard label="Device ID" value={<span className="font-mono text-[13px]">{(status.device_id || "—").slice(0, 8)}…</span>} />
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Work offline</h3>
                <p className="mt-1 max-w-2xl text-[13px] text-foreground-secondary">
                  When on, this device stops talking to the server. Your edits keep working against the local
                  copy and queue up; they push automatically the moment you switch back online.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOffline(!offline)}
                disabled={busy}
                role="switch"
                aria-checked={offline}
                className={
                  "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
                  (offline ? "bg-warning" : "bg-accent")
                }
              >
                <span className={"inline-block h-4 w-4 rounded-full bg-white transition-transform " + (offline ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
            {status.last_error && (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">Last error: {status.last_error}</p>
            )}
          </div>
        </div>
      )}

      {tab === "modules" && (
        <div className="mt-6 rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border-subtle text-foreground-secondary">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Module</th>
                <th className="px-4 py-2 text-right font-medium">Pending</th>
                <th className="px-4 py-2 text-right font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {tables.length === 0 ? (
                <tr><td className="px-4 py-6 text-foreground-muted" colSpan={3}>No modules registered for sync yet.</td></tr>
              ) : (
                tables.map((m) => (
                  <tr key={m} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-foreground">
                        <Database className="h-4 w-4 text-foreground-muted" /> {m}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{perModel[m] || 0}</td>
                    <td className="px-4 py-2.5 text-right">
                      {perModel[m] ? <span className="text-warning">queued</span> : <span className="text-success">synced</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "pending" && (
        <div className="mt-6 space-y-3">
          {/* Manual-confirm banner when auto-sync is off */}
          {!autoSync && pending.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
              <p className="text-[13px] text-foreground-secondary">
                <span className="font-semibold text-foreground">Auto-sync is off.</span> Review each change and confirm to push it.
              </p>
              <button
                onClick={forceSync}
                disabled={busy || offline}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Confirm all
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListChecks className="h-8 w-8 text-foreground-muted" />
                <p className="mt-3 text-[14px] font-medium text-foreground">Nothing pending</p>
                <p className="text-[13px] text-foreground-secondary">Every local change has been pushed to the server.</p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-border-subtle text-foreground-secondary">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left font-medium">Change</th>
                    <th className="px-4 py-2 text-left font-medium">Record</th>
                    <th className="px-4 py-2 text-left font-medium">Module</th>
                    <th className="px-4 py-2 text-left font-medium">When</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => {
                    const data = parseGoBytes(p.Data);
                    const label = entityLabel(data, p.EntityID);
                    const isOpen = expanded === p.ID;
                    const rowBusy = acting === p.ID;
                    return (
                      <React.Fragment key={p.ID}>
                        <tr className="border-b border-border-subtle last:border-0 hover:bg-surface-hover/40">
                          <td className="px-2 py-2.5 align-top">
                            <button
                              onClick={() => setExpanded(isOpen ? null : p.ID)}
                              className="rounded p-0.5 text-foreground-muted hover:text-foreground"
                              title="Details"
                            >
                              <ChevronRight className={"h-4 w-4 transition-transform " + (isOpen ? "rotate-90" : "")} />
                            </button>
                          </td>
                          <td className="px-2 py-2.5"><OpBadge op={p.Op} /></td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-foreground">{label}</div>
                            <div className="font-mono text-[11px] text-foreground-muted">{String(p.EntityID).slice(0, 8)}…</div>
                          </td>
                          <td className="px-4 py-2.5 text-foreground-secondary">{p.Model}</td>
                          <td className="px-4 py-2.5 text-foreground-muted">{relTimeUnix(p.CreatedAt)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {p.HasConflict ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                                  <AlertTriangle className="h-3 w-3" /> conflict
                                </span>
                              ) : (
                                !autoSync && (
                                  <button
                                    onClick={() => doConfirm(p)}
                                    disabled={rowBusy || offline}
                                    className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-[12px] font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
                                    title="Push this change now"
                                  >
                                    {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirm
                                  </button>
                                )
                              )}
                              <button
                                onClick={() => doRevert(p)}
                                disabled={rowBusy}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-foreground-secondary hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                title="Discard this change"
                              >
                                {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Revert
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border-subtle bg-surface-2/40 last:border-0">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              {p.HasConflict && p.ConflictMsg && (
                                <p className="mb-2 rounded-md bg-danger/10 px-3 py-1.5 text-[12px] text-danger">{p.ConflictMsg}</p>
                              )}
                              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                                {fieldSummary(data).map((f) => (
                                  <div key={f.key} className="flex items-baseline gap-2 text-[12px]">
                                    <span className="w-28 shrink-0 truncate font-mono text-foreground-muted">{f.key}</span>
                                    <span className="truncate text-foreground">{f.value}</span>
                                  </div>
                                ))}
                                {fieldSummary(data).length === 0 && (
                                  <span className="text-[12px] text-foreground-muted">No field data (e.g. a delete).</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Discard-all control */}
          {pending.length > 0 && (
            <div className="flex justify-end">
              {confirmDiscardAll ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-foreground-secondary">Discard all {pending.length} pending changes?</span>
                  <button onClick={doRevertAll} disabled={acting === -1} className="inline-flex items-center gap-1 rounded-md bg-danger px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {acting === -1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Yes, discard all
                  </button>
                  <button onClick={() => setConfirmDiscardAll(false)} className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground-secondary hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDiscardAll(true)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground-secondary hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" /> Discard all
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Auto-sync when online</h3>
                <p className="mt-1 max-w-2xl text-[13px] text-foreground-secondary">
                  On by default: the moment this device is back online, queued changes push automatically. Turn it
                  off to review and confirm each change yourself — your edits stay queued on the{" "}
                  <span className="font-medium text-foreground">Pending changes</span> tab until you confirm them
                  (all at once, or one by one). Fresh server data still pulls in either way.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoSync(!autoSync)}
                disabled={busy}
                role="switch"
                aria-checked={autoSync}
                className={
                  "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
                  (autoSync ? "bg-accent" : "bg-foreground-muted/40")
                }
              >
                <span className={"inline-block h-4 w-4 rounded-full bg-white transition-transform " + (autoSync ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-foreground-secondary">
              {autoSync ? (
                <><Cloud className="h-4 w-4 text-success" /> Changes push automatically when you reconnect.</>
              ) : (
                <><CloudOff className="h-4 w-4 text-warning" /> Manual mode — confirm changes on the Pending tab to push them.</>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
