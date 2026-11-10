import { useEffect } from "react";
import { uploadFile, type FileRef } from "@/lib/api-client";
import { getSyncTables } from "@/lib/wails-bridge";
import { localList, localUpdate } from "@/lib/sync-client";
import { useSyncStatus } from "@/hooks/use-sync-status";

function isPendingRef(v: unknown): v is FileRef {
  return !!v && typeof v === "object" && typeof (v as any).url === "string" && (v as any).url.startsWith("data:");
}

async function uploadRef(ref: FileRef): Promise<FileRef> {
  const blob = await (await fetch(ref.url)).blob();
  const file = new File([blob], ref.name || "upload", { type: ref.mime || blob.type });
  return uploadFile(file);
}

// Returns a patched record if any pending file refs were uploaded, else null.
async function reconcile(row: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  let changed = false;
  const data: Record<string, unknown> = { ...row };
  for (const [key, val] of Object.entries(row)) {
    if (isPendingRef(val)) {
      data[key] = await uploadRef(val);
      changed = true;
    } else if (Array.isArray(val) && val.some(isPendingRef)) {
      data[key] = await Promise.all(val.map((v) => (isPendingRef(v) ? uploadRef(v) : v)));
      changed = true;
    }
  }
  return changed ? data : null;
}

export function usePendingUploads() {
  const { status } = useSyncStatus();
  const online = status.reachable && !status.force_offline;

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        const tables = await getSyncTables();
        for (const table of tables) {
          if (cancelled) return;
          const rows = await localList(table).catch(() => [] as Record<string, unknown>[]);
          for (const row of rows) {
            if (cancelled) return;
            const patched = await reconcile(row).catch(() => null);
            if (patched && !cancelled) await localUpdate(table, String((row as any).id), patched);
          }
        }
      } catch {
        /* best-effort — retried on the next online transition */
      }
    })();
    return () => { cancelled = true; };
  }, [online]);
}
