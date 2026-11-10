/// <reference types="vite/client" />

// Wails bindings are injected at runtime. This is a placeholder type so
// TypeScript compiles before the first build generates wailsjs/.
//
// IMPORTANT: every method bound on the Go App struct (app.go) must be declared
// here, or any file that calls it fails typechecking — which is what
// "pnpm build" (and therefore "wails build") runs. Add a binding in app.go?
// Add it here too.

// Structural mirrors of the Go sync types. Kept structural (not imported) so
// this .d.ts has no module dependencies; lib/sync-client.ts declares the same
// shapes and TypeScript matches them by structure.
type WailsSyncResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors?: string[];
  started_at: string;
  finished_at: string;
};

type WailsOutboxEntry = {
  ID: number;
  Model: string;
  EntityID: string;
  Op: "create" | "update" | "delete";
  Data: string | null;
  Version: number;
  CreatedAt: number;
  HasConflict: boolean;
  ServerData: string | null;
  ServerVersion: number;
  ConflictMsg: string;
};

type WailsSyncStatus = {
  reachable: boolean;
  force_offline: boolean;
  auto_sync: boolean;
  syncing: boolean;
  pending: number;
  last_sync?: string;
  last_error?: string;
  device_id?: string;
  tables?: string[];
};

declare global {
  interface Window {
    runtime?: {
      EventsOn: (event: string, callback: (...args: unknown[]) => void) => void;
      EventsEmit: (event: string, ...args: unknown[]) => void;
    };
    go?: {
      main: {
        App: {
          SetToken: (key: string, value: string) => Promise<void>;
          GetToken: (key: string) => Promise<string>;
          DeleteToken: (key: string) => Promise<void>;
          MinimiseWindow: () => Promise<void>;
          MaximiseWindow: () => Promise<void>;
          UnmaximiseWindow: () => Promise<void>;
          ToggleMaximise: () => Promise<void>;
          CloseWindow: () => Promise<void>;
          IsMaximised: () => Promise<boolean>;
          OpenFileDialog: (title: string) => Promise<string>;
          SaveFileDialog: (title: string, defaultFilename: string) => Promise<string>;
          GetPlatform: () => Promise<"darwin" | "windows" | "linux">;
          GetAppVersion: () => Promise<string>;

          // Offline sync engine (local mirror + outbox)
          LocalCreate: (table: string, id: string, data: Record<string, unknown>) => Promise<void>;
          LocalUpdate: (table: string, id: string, data: Record<string, unknown>) => Promise<void>;
          LocalDelete: (table: string, id: string) => Promise<void>;
          LocalGet: (table: string, id: string) => Promise<Record<string, unknown> | null>;
          LocalList: (table: string) => Promise<Record<string, unknown>[]>;
          Sync: (tables: string[]) => Promise<WailsSyncResult>;
          PendingCount: () => Promise<number>;
          GetPendingChanges: () => Promise<WailsOutboxEntry[]>;
          ResolveConflict: (
            table: string,
            entityID: string,
            mergedData: Record<string, unknown>,
            serverVersion: number,
          ) => Promise<void>;

          // Online/offline mode
          GetSyncTables: () => Promise<string[]>;
          SetOfflineMode: (offline: boolean) => Promise<void>;
          GetSyncStatus: () => Promise<WailsSyncStatus>;
          SyncNow: () => Promise<WailsSyncResult>;

          // Auto-sync preference + manual confirm / revert
          SetAutoSync: (enabled: boolean) => Promise<void>;
          ConfirmChange: (table: string, entityID: string) => Promise<void>;
          RevertChange: (table: string, entityID: string) => Promise<void>;
          RevertAll: () => Promise<void>;
        };
      };
    };
  }
}

export {};
