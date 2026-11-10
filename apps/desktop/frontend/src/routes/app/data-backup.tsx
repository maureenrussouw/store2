import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Database, Download, RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock, HardDriveDownload, Save,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  useBackups, useGenerateBackup, useDownloadBackup, useBackupSchedule, useUpdateBackupSchedule,
  type Backup, type BackupFrequency,
} from "@/hooks/use-backups";

export const Route = createFileRoute("/app/data-backup")({ component: DataBackupPage });

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS: Record<Backup["status"], { cls: string; icon: React.ElementType }> = {
  RUNNING: { cls: "bg-info/10 text-info", icon: Loader2 },
  READY: { cls: "bg-success/10 text-success", icon: CheckCircle2 },
  FAILED: { cls: "bg-danger/10 text-danger", icon: AlertCircle },
  PURGED: { cls: "bg-foreground-muted/10 text-foreground-muted", icon: Database },
};

function StatusBadge({ status }: { status: Backup["status"] }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + s.cls}>
      <Icon className={"h-3 w-3 " + (status === "RUNNING" ? "animate-spin" : "")} /> {status}
    </span>
  );
}

const FREQUENCIES: { key: BackupFrequency; label: string; hint: string }[] = [
  { key: "daily", label: "Daily", hint: "every day" },
  { key: "weekly", label: "Weekly", hint: "every Sunday" },
  { key: "monthly", label: "Monthly", hint: "1st of month" },
  { key: "yearly", label: "Yearly", hint: "Jan 1" },
];

function ScheduleCard() {
  const { data: schedule, isLoading } = useBackupSchedule();
  const update = useUpdateBackupSchedule();
  const [freq, setFreq] = useState<BackupFrequency>("weekly");
  const [time, setTime] = useState("02:00");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (schedule) { setFreq(schedule.frequency); setTime(schedule.time); setEnabled(schedule.enabled); }
  }, [schedule]);

  const dirty = schedule && (schedule.frequency !== freq || schedule.time !== time || schedule.enabled !== enabled);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent"><Clock className="h-5 w-5" /></span>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Automatic backups</h3>
            <p className="text-[13px] text-foreground-secondary">A full backup runs on this schedule. Default is weekly.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          role="switch"
          aria-checked={enabled}
          className={"relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " + (enabled ? "bg-accent" : "bg-foreground-muted/40")}
        >
          <span className={"inline-block h-4 w-4 rounded-full bg-white transition-transform " + (enabled ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>

      <div className={"mt-4 transition-opacity " + (enabled ? "" : "pointer-events-none opacity-50")}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">Frequency</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFreq(f.key)}
              className={
                "rounded-lg border px-3 py-2.5 text-center transition-colors " +
                (freq === f.key ? "border-accent bg-accent/5 text-accent" : "border-border text-foreground-secondary hover:bg-surface-hover")
              }
            >
              <div className="text-[13px] font-medium text-foreground">{f.label}</div>
              <div className="text-[11px] text-foreground-muted">{f.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-end gap-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">Time of day</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </div>
          <span className="pb-2 text-[12px] text-foreground-muted">server local time</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {update.isSuccess && !dirty && <span className="text-[12px] text-success">Saved</span>}
        {update.isError && <span className="text-[12px] text-danger">Couldn&apos;t save</span>}
        <button
          onClick={() => update.mutate({ frequency: freq, time, enabled })}
          disabled={isLoading || update.isPending || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save schedule
        </button>
      </div>
    </div>
  );
}

function DataBackupPage() {
  const { data: backups, isLoading } = useBackups();
  const generate = useGenerateBackup();
  const download = useDownloadBackup();

  const list = backups ?? [];
  const running = list.some((b) => b.status === "RUNNING");
  const latest = list.find((b) => b.status === "READY");

  return (
    <div>
      <PageHeader title="Data & Backup" description="Full-database snapshots — schedule them, or take one on demand." />

      <div className="mt-6 space-y-4">
        <ScheduleCard />

        {/* Latest + generate */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><HardDriveDownload className="h-6 w-6" /></span>
              <div>
                <div className="text-[13px] text-foreground-secondary">Latest backup</div>
                {latest ? (
                  <>
                    <div className="text-[16px] font-semibold text-foreground">{formatDate(latest.created_at)}</div>
                    <div className="text-[12px] text-foreground-muted">{formatBytes(latest.size_bytes)} · {latest.table_count} tables · {latest.row_count.toLocaleString()} rows</div>
                  </>
                ) : (
                  <div className="text-[15px] font-medium text-foreground-muted">No backup yet</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {latest && (
                <button
                  onClick={() => download.mutate(latest.id)}
                  disabled={download.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
              )}
              <button
                onClick={() => generate.mutate()}
                disabled={generate.isPending || running}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {generate.isPending || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Generate now
              </button>
            </div>
          </div>
          {generate.isError && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {(generate.error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Failed to start the backup"}
            </p>
          )}
        </div>

        {/* History */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-3 text-[13px] font-semibold text-foreground">Recent backups</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-foreground-muted" /></div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Database className="h-8 w-8 text-foreground-muted" />
              <p className="mt-3 text-[14px] font-medium text-foreground">No backups yet</p>
              <p className="text-[13px] text-foreground-secondary">Generate one now, or wait for the next scheduled run.</p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-border-subtle text-foreground-secondary">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Kind</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Size</th>
                  <th className="px-4 py-2 text-right font-medium">Rows</th>
                  <th className="px-5 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-5 py-2.5 text-foreground">{formatDate(b.created_at)}</td>
                    <td className="px-4 py-2.5 text-foreground-secondary">{b.kind}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={b.status} />
                      {b.status === "FAILED" && b.error && <div className="mt-1 max-w-xs truncate text-[11px] text-danger" title={b.error}>{b.error}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground-secondary">{formatBytes(b.size_bytes)}</td>
                    <td className="px-4 py-2.5 text-right text-foreground-secondary">{b.row_count ? b.row_count.toLocaleString() : "—"}</td>
                    <td className="px-5 py-2.5 text-right">
                      {b.status === "READY" && (
                        <button
                          onClick={() => download.mutate(b.id)}
                          disabled={download.isPending}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[12px] font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-[12px] text-foreground-muted">
          Each archive is a ZIP: one CSV per table, a <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">dump.sql</code> of INSERTs,
          and a <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">metadata.json</code> manifest. Restore with <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">grit restore backup.zip</code>.
        </p>
      </div>
    </div>
  );
}
