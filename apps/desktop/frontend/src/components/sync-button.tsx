import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingCount } from "@/hooks/use-sync";
import { PendingChangesPanel } from "@/components/pending-changes";

// SyncButton sits in the title-bar next to the connection indicator.
// Shows a pending-count badge; click opens the PendingChangesPanel
// (drawer over the right edge) where the user can review and push.
//
// tables is the list of model names this app cares about — passed down
// to the panel which forwards it to Sync(). For most apps this is a
// const at the layout level: ["buildings", "tenants", "leases", ...].
export function SyncButton({ tables }: { tables: string[] }) {
  const [open, setOpen] = useState(false);
  const count = usePendingCount();
  const hasPending = count > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "no-drag flex h-titlebar items-center gap-1.5 px-3 transition-colors",
          hasPending
            ? "text-warning hover:text-warning"
            : "text-foreground-muted hover:text-foreground",
        )}
        title={hasPending ? count + " pending change" + (count === 1 ? "" : "s") + " - click to sync" : "All synced"}
      >
        {hasPending ? <AlertCircle className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {hasPending && (
          <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
            {count}
          </span>
        )}
      </button>
      {open && <PendingChangesPanel tables={tables} onClose={() => setOpen(false)} />}
    </>
  );
}
