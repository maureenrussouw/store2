import { useEffect, useState } from "react";
import {
  pendingCount,
  getPendingChanges,
  sync,
  resolveConflict,
  type OutboxEntry,
  type SyncResult,
} from "@/lib/sync-client";

// useSync wraps the Wails sync bindings with React state. We avoid React
// Query here because the source of truth is the Wails Go process — not
// the API — and React Query's network-defaults don't fit the
// IPC-not-HTTP nature of the bindings.

// usePendingCount polls the engine every POLL_MS for an updated count.
// Cheap because PendingCount is a single SELECT COUNT(*) on a small
// table. Wires to the title-bar Sync button badge.
const POLL_MS = 2_000;

export function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const n = await pendingCount();
        if (!cancelled) setCount(n);
      } catch {
        // ignore — Wails may not be initialized yet on first render
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return count;
}

// usePendingChanges fetches the full outbox once and exposes a refresh
// fn. Used by the pending-changes panel.
export function usePendingChanges() {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await getPendingChanges();
      setEntries(rows || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads once, on mount.
  useEffect(() => {
    refresh();
  }, []);

  return { entries, loading, error, refresh };
}

// useSyncMutation runs a Sync against the supplied tables and tracks
// running / result state. The caller passes the list of tables the app
// cares about (e.g. ["buildings", "tenants"]).
export function useSyncMutation(tables: string[]) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await sync(tables);
      setResult(r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setRunning(false);
    }
  };

  return { run, running, result, error };
}

// useResolveConflict applies a merge for a single conflicted entry.
// The hook itself is a thin wrapper; consumers should refresh the
// pending list after a successful resolve.
export function useResolveConflict() {
  const [resolving, setResolving] = useState(false);
  const resolve = async (
    table: string,
    entityID: string,
    mergedData: Record<string, unknown>,
    serverVersion: number,
  ) => {
    setResolving(true);
    try {
      await resolveConflict(table, entityID, mergedData, serverVersion);
    } finally {
      setResolving(false);
    }
  };
  return { resolve, resolving };
}
