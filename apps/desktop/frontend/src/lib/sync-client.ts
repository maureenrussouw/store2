// Typed wrappers around the Wails sync bindings exposed by App. Use
// these instead of touching window.go directly so the call sites are
// type-checked.

export interface OutboxEntry {
  ID: number;
  Model: string;
  EntityID: string;
  Op: "create" | "update" | "delete";
  Data: string | null;            // JSON-encoded byte slice from Go
  Version: number;
  CreatedAt: number;
  HasConflict: boolean;
  ServerData: string | null;       // JSON-encoded server state on conflict
  ServerVersion: number;
  ConflictMsg: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors?: string[];
  started_at: string;
  finished_at: string;
}

const isWails = typeof window !== "undefined" && !!window.go?.main?.App;

function notWailsError(): never {
  throw new Error("Sync requires the Wails desktop runtime (run via 'wails dev').");
}

export async function localCreate(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.LocalCreate(table, id, data);
}

export async function localUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.LocalUpdate(table, id, data);
}

export async function localDelete(table: string, id: string): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.LocalDelete(table, id);
}

export async function localGet(
  table: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  if (!isWails) notWailsError();
  return window.go!.main.App.LocalGet(table, id);
}

export async function localList(
  table: string,
): Promise<Record<string, unknown>[]> {
  if (!isWails) notWailsError();
  return window.go!.main.App.LocalList(table);
}

export async function sync(tables: string[]): Promise<SyncResult> {
  if (!isWails) notWailsError();
  return window.go!.main.App.Sync(tables);
}

export async function pendingCount(): Promise<number> {
  if (!isWails) return 0;
  return window.go!.main.App.PendingCount();
}

export async function getPendingChanges(): Promise<OutboxEntry[]> {
  if (!isWails) return [];
  return window.go!.main.App.GetPendingChanges();
}

export async function resolveConflict(
  table: string,
  entityID: string,
  mergedData: Record<string, unknown>,
  serverVersion: number,
): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.ResolveConflict(table, entityID, mergedData, serverVersion);
}

// confirmChange pushes a single queued change now (the per-row "Confirm" action
// used when auto-sync is off).
export async function confirmChange(table: string, entityID: string): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.ConfirmChange(table, entityID);
}

// revertChange discards a single queued change and restores server state for it.
export async function revertChange(table: string, entityID: string): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.RevertChange(table, entityID);
}

// revertAll discards every queued change and restores server state.
export async function revertAll(): Promise<void> {
  if (!isWails) notWailsError();
  return window.go!.main.App.RevertAll();
}

// Helper: parse the JSON-encoded byte slices Go sends through Wails.
// Wails serializes []byte as a base64 string OR a stringified JSON
// depending on version; this handles both.
export function parseGoBytes(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(atob(s));
    } catch {
      return null;
    }
  }
}
