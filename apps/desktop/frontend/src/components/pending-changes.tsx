import { useState } from "react";
import { X, RefreshCw, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseGoBytes, type OutboxEntry } from "@/lib/sync-client";
import { usePendingChanges, useSyncMutation } from "@/hooks/use-sync";
import { ConflictDialog } from "@/components/conflict-dialog";

// PendingChangesPanel is a right-edge drawer listing every outbox
// entry. The user sees what's about to push, then clicks "Sync now".
// On success, conflict entries surface a per-entry "Resolve" button
// that opens the ConflictDialog.
//
// The drawer fixed-positions itself over the rest of the app — clean
// and predictable on desktop. No animation, no tricks.
export function PendingChangesPanel({
  tables,
  onClose,
}: {
  tables: string[];
  onClose: () => void;
}) {
  const { entries, refresh } = usePendingChanges();
  const { run, running } = useSyncMutation(tables);
  const [conflictEntry, setConflictEntry] = useState<OutboxEntry | null>(null);

  const handleSync = async () => {
    try {
      await run();
      await refresh();
    } catch {
      // useSyncMutation surfaces the error; refresh anyway so the user
      // sees what's still pending.
      await refresh();
    }
  };

  const conflicts = entries.filter((e) => e.HasConflict);
  const clean = entries.filter((e) => !e.HasConflict);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-[420px] bg-surface border-l border-border flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Pending changes</h2>
            <p className="text-[12px] text-foreground-muted mt-0.5">
              {entries.length === 0 ? "Nothing to sync" : entries.length + " in outbox"}
              {conflicts.length > 0 && ", " + conflicts.length + " in conflict"}
            </p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {conflicts.length > 0 && (
            <section className="border-b border-border-subtle">
              <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-warning">
                Needs review ({conflicts.length})
              </h3>
              {conflicts.map((e) => (
                <PendingRow key={e.ID} entry={e} onResolve={() => setConflictEntry(e)} />
              ))}
            </section>
          )}
          {clean.length > 0 && (
            <section>
              <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                Ready to push ({clean.length})
              </h3>
              {clean.map((e) => (
                <PendingRow key={e.ID} entry={e} />
              ))}
            </section>
          )}
          {entries.length === 0 && (
            <div className="p-8 text-center text-[13px] text-foreground-muted">
              No pending changes. Everything is synced.
            </div>
          )}
        </div>

        <footer className="border-t border-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={refresh}
            className="text-[12px] text-foreground-muted hover:text-foreground"
          >
            Refresh
          </button>
          <button
            onClick={handleSync}
            disabled={running || entries.length === 0}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium transition-colors",
              "bg-accent text-accent-fg hover:bg-accent-hover",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
            {running ? "Syncing..." : "Sync now"}
          </button>
        </footer>
      </aside>

      {conflictEntry && (
        <ConflictDialog
          entry={conflictEntry}
          onClose={() => setConflictEntry(null)}
          onResolved={() => {
            setConflictEntry(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function PendingRow({
  entry,
  onResolve,
}: {
  entry: OutboxEntry;
  onResolve?: () => void;
}) {
  const data = parseGoBytes(entry.Data);
  const Icon = entry.Op === "create" ? Plus : entry.Op === "delete" ? Trash2 : Pencil;
  const opColor =
    entry.Op === "create"
      ? "text-success"
      : entry.Op === "delete"
        ? "text-danger"
        : "text-info";

  return (
    <div className="px-4 py-2.5 border-b border-border-subtle hover:bg-surface-hover">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", opColor)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground">
            {entry.Op} {entry.Model}
          </div>
          <div className="text-[11.5px] text-foreground-muted truncate font-mono">
            {entry.EntityID.slice(0, 8)}{data && data.name ? " · " + String(data.name) : ""}
          </div>
          {entry.HasConflict && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="h-3 w-3" />
              {entry.ConflictMsg || "Server has a newer version"}
            </div>
          )}
        </div>
        {entry.HasConflict && onResolve && (
          <button
            onClick={onResolve}
            className="shrink-0 h-7 px-2.5 rounded-md bg-warning/10 hover:bg-warning/20 text-warning text-[11.5px] font-medium"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
