import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/hooks/use-sync-status";

// OfflineModeToggle is the dashboard control for switching between online
// (mirror + sync) and offline (work against the local copy) mode. When online
// it shows reachability + pending count; when offline it shows how many edits
// are queued to push on reconnect.
export function OfflineModeToggle() {
  const { status, busy, setOffline, forceSync } = useSyncStatus();
  const offline = status.force_offline;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
      {offline ? (
        <CloudOff className="h-4 w-4 text-warning" />
      ) : (
        <Cloud className={"h-4 w-4 " + (status.reachable ? "text-success" : "text-danger")} />
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground">
          {offline ? "Working offline" : status.reachable ? "Online" : "Server unreachable"}
        </div>
        <div className="text-[11px] text-foreground-muted">
          {status.pending > 0
            ? status.pending + " change" + (status.pending === 1 ? "" : "s") + " waiting to sync"
            : status.last_sync
              ? "Last synced " + new Date(status.last_sync).toLocaleTimeString()
              : "All changes synced"}
        </div>
      </div>

      {!offline && status.reachable && (
        <button
          type="button"
          onClick={forceSync}
          disabled={busy}
          title="Sync now"
          className="rounded p-1.5 text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (busy ? "animate-spin" : "")} />
        </button>
      )}

      <button
        type="button"
        onClick={() => setOffline(!offline)}
        disabled={busy}
        role="switch"
        aria-checked={offline}
        title={offline ? "Switch back online" : "Switch to offline mode"}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
          (offline ? "bg-warning" : "bg-accent")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 rounded-full bg-white transition-transform " +
            (offline ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
