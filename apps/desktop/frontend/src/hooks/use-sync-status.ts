import { useCallback, useEffect, useState } from "react";
import {
  getSyncStatus,
  setOfflineMode as setOfflineModeBridge,
  setAutoSync as setAutoSyncBridge,
  syncNow,
  type SyncStatus,
} from "@/lib/wails-bridge";

// useSyncStatus polls the engine every 4s (and on demand) for the
// reachable/offline/pending snapshot, and exposes actions to toggle offline
// mode and force a sync.
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    reachable: true,
    force_offline: false,
    auto_sync: true,
    syncing: false,
    pending: 0,
  });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getSyncStatus());
    } catch {
      /* engine not ready yet — keep last snapshot */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const setOffline = useCallback(
    async (offline: boolean) => {
      setBusy(true);
      try {
        await setOfflineModeBridge(offline);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const forceSync = useCallback(async () => {
    setBusy(true);
    try {
      await syncNow();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const setAutoSync = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      try {
        await setAutoSyncBridge(enabled);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { status, busy, setOffline, setAutoSync, forceSync, refresh };
}
