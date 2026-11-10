import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseGoBytes, type OutboxEntry } from "@/lib/sync-client";
import { useResolveConflict } from "@/hooks/use-sync";

// ConflictDialog is the field-level merge UI. When push hits a
// VERSION_CONFLICT, the outbox entry stores both the local payload
// (Data) and the server's current state (ServerData). We diff them
// and let the user pick a side per field.
//
// "Local" = the value the user typed offline.
// "Server" = the value some other client (or this user on another
// device) wrote since the last sync.
//
// On Resolve we build the merged record by walking each field's choice
// and call ResolveConflict() with the result + the new ServerVersion.
// The next Sync replays the entry with that version as the optimistic-
// lock check, so it'll succeed cleanly.
export function ConflictDialog({
  entry,
  onClose,
  onResolved,
}: {
  entry: OutboxEntry;
  onClose: () => void;
  onResolved: () => void;
}) {
  const local = useMemo(() => parseGoBytes(entry.Data) ?? {}, [entry.Data]);
  const server = useMemo(() => parseGoBytes(entry.ServerData) ?? {}, [entry.ServerData]);
  const { resolve, resolving } = useResolveConflict();

  // Hidden / system fields we don't want to expose in the merge UI.
  const HIDE_FIELDS = new Set([
    "id",
    "version",
    "created_at",
    "updated_at",
    "deleted_at",
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: HIDE_FIELDS is a fixed list, rebuilt each render.
  const allFields = useMemo(() => {
    const set = new Set<string>([...Object.keys(local), ...Object.keys(server)]);
    for (const k of HIDE_FIELDS) set.delete(k);
    return Array.from(set).sort();
  }, [local, server]);

  // Per-field choice: "local" or "server". Default to "local" because
  // the user just made those edits — they probably want to keep them.
  const [choices, setChoices] = useState<Record<string, "local" | "server">>(
    () => {
      const initial: Record<string, "local" | "server"> = {};
      for (const f of allFields) initial[f] = "local";
      return initial;
    },
  );

  const handleResolve = async () => {
    const merged: Record<string, unknown> = { ...server }; // start from server state
    for (const field of allFields) {
      merged[field] = choices[field] === "local" ? local[field] : server[field];
    }
    // Preserve the ID so the wire payload is consistent.
    merged.id = entry.EntityID;
    await resolve(entry.Model, entry.EntityID, merged, entry.ServerVersion);
    onResolved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-xl flex flex-col">
        <header className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">
              Resolve conflict: {entry.Op} {entry.Model}
            </h2>
            <p className="text-[12.5px] text-foreground-muted mt-1">
              The server has a newer version (v{entry.ServerVersion}) than what you edited locally.
              Pick which side wins for each field.
            </p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <div className="grid grid-cols-[1fr,160px,160px] gap-3 text-[11px] uppercase tracking-wider text-foreground-muted pb-2 border-b border-border-subtle">
            <div>Field</div>
            <div>Local</div>
            <div>Server (v{entry.ServerVersion})</div>
          </div>

          {allFields.length === 0 && (
            <div className="py-6 text-center text-[13px] text-foreground-muted">
              No editable fields differ — nothing to merge.
            </div>
          )}

          {allFields.map((field) => {
            const localVal = local[field];
            const serverVal = server[field];
            const sameValue =
              JSON.stringify(localVal) === JSON.stringify(serverVal);
            const choice = choices[field];

            return (
              <div
                key={field}
                className={cn(
                  "grid grid-cols-[1fr,160px,160px] gap-3 py-2 items-center",
                  sameValue ? "opacity-50" : "",
                )}
              >
                <div className="text-[13px] font-medium text-foreground-secondary">
                  {field}
                  {sameValue && (
                    <span className="ml-2 text-[10px] text-foreground-muted">unchanged</span>
                  )}
                </div>
                <FieldCell
                  value={localVal}
                  selected={choice === "local"}
                  disabled={sameValue}
                  onClick={() => !sameValue && setChoices({ ...choices, [field]: "local" })}
                />
                <FieldCell
                  value={serverVal}
                  selected={choice === "server"}
                  disabled={sameValue}
                  onClick={() => !sameValue && setChoices({ ...choices, [field]: "server" })}
                />
              </div>
            );
          })}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface text-[13px] font-medium text-foreground-secondary hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="h-9 px-3.5 rounded-lg bg-accent text-accent-fg text-[13px] font-medium hover:bg-accent-hover disabled:opacity-60"
          >
            {resolving ? "Resolving..." : "Apply merge"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FieldCell({
  value,
  selected,
  disabled,
  onClick,
}: {
  value: unknown;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const display =
    value === null || value === undefined
      ? "(empty)"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-[12.5px] text-left truncate border transition-colors",
        selected
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border bg-surface-2 text-foreground-secondary hover:bg-surface-hover",
        disabled && "cursor-not-allowed",
      )}
      title={display}
    >
      {display}
    </button>
  );
}
