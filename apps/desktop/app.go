package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	goruntime "runtime"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"store2/apps/desktop/sync"
)

// syncTables is the single source of truth for which models the background
// auto-sync loop and manual Sync cover. The frontend reads it via
// GetSyncTables(), and ~grit generate resource~ appends new resources at the
// marker below — so a new resource joins offline sync automatically.
var syncTables = []string{
	// Never users or uploads: the API refuses to sync them, since a push is a
	// generic write and a user row carries its own role.
	"categories",
	"products",
	"customers",
	"invoice_items",
	"invoices",
	"order_lines",
	"orders",
	"repayments",
	"loans",
	"line_charges",
	"subscriptions",
	"medications",
	"prescriptions",
	// grit:sync-tables
}

// App exposes native OS methods + the offline sync engine to the React
// frontend via Wails bindings. Online business logic still goes through
// HTTP to the shared API; offline-first writes go through the Local*
// methods below, which queue them in the sync engine's outbox until the
// user explicitly clicks "Sync".
type App struct {
	ctx    context.Context
	kc     *Keychain
	sync   *sync.Engine
	apiURL string
}

func NewApp() *App {
	return &App{
		kc: NewKeychain(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Configure the sync engine. The local SQLite lives under the OS-
	// standard user data dir so it survives app updates.
	a.apiURL = os.Getenv("VITE_API_URL")
	if a.apiURL == "" {
		a.apiURL = "http://localhost:8080/api"
	}
	dataDir, err := os.UserConfigDir()
	if err != nil {
		dataDir, _ = os.UserHomeDir()
	}
	dbPath := filepath.Join(dataDir, "store2", "sync.db")
	engine, err := sync.Open(dbPath, a.apiURL, func() (string, error) {
		v, _ := a.kc.Get("access_token")
		return v, nil
	})
	if err != nil {
		// Don't crash the whole app; offline features will simply fail
		// closed. The frontend can warn the user via SyncStatus().
		fmt.Println("[sync] open failed:", err)
		return
	}
	a.sync = engine

	// Start the background mirror loop. While the server is reachable and the
	// user hasn't chosen "Work offline", this pulls fresh server data into the
	// local mirror and pushes any queued offline edits every 30s — so going
	// offline always has recent data, and coming back online auto-reconciles.
	engine.StartAutoSync(syncTables, 30*time.Second)
}

// ─── Token storage (OS keychain) ──────────────────────────────────

func (a *App) SetToken(key, value string) error {
	return a.kc.Set(key, value)
}

func (a *App) GetToken(key string) string {
	v, _ := a.kc.Get(key)
	return v
}

func (a *App) DeleteToken(key string) error {
	return a.kc.Delete(key)
}

// ─── Window controls ──────────────────────────────────────────────

func (a *App) MinimiseWindow()   { wailsruntime.WindowMinimise(a.ctx) }
func (a *App) MaximiseWindow()   { wailsruntime.WindowMaximise(a.ctx) }
func (a *App) UnmaximiseWindow() { wailsruntime.WindowUnmaximise(a.ctx) }
func (a *App) ToggleMaximise()   { wailsruntime.WindowToggleMaximise(a.ctx) }
func (a *App) CloseWindow()      { wailsruntime.Quit(a.ctx) }
func (a *App) IsMaximised() bool { return wailsruntime.WindowIsMaximised(a.ctx) }

// ─── File dialogs ─────────────────────────────────────────────────

func (a *App) OpenFileDialog(title string) (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: title,
	})
}

func (a *App) SaveFileDialog(title, defaultFilename string) (string, error) {
	return wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: defaultFilename,
	})
}

// ─── System info ──────────────────────────────────────────────────

// GetPlatform returns "darwin" | "windows" | "linux".
func (a *App) GetPlatform() string {
	return goruntime.GOOS
}

// GetAppVersion returns the build version.
func (a *App) GetAppVersion() string {
	return "0.1.0"
}

// ─── Offline sync (local-first CRUD + push/pull orchestration) ────
//
// Frontend usage:
//   await LocalCreate("buildings", "", { name: "Foo" })   // generates UUID
//   await LocalUpdate("buildings", id, { name: "Bar" })
//   await LocalDelete("buildings", id)
//   const items = await LocalList("buildings")
//   const result = await Sync(["buildings", "tenants"])
//   if (result.conflicts > 0) { /* open conflict dialog */ }
//
// Reads come from the local SQLite mirror, populated by Sync's pull
// phase. Writes are queued in the outbox and only hit the network when
// the user clicks Sync.

func (a *App) LocalCreate(table, id string, data map[string]interface{}) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.LocalCreate(table, id, data)
}

func (a *App) LocalUpdate(table, id string, data map[string]interface{}) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.LocalUpdate(table, id, data)
}

func (a *App) LocalDelete(table, id string) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.LocalDelete(table, id)
}

func (a *App) LocalGet(table, id string) (map[string]interface{}, error) {
	if a.sync == nil {
		return nil, fmt.Errorf("sync engine not initialized")
	}
	return a.sync.LocalGet(table, id)
}

func (a *App) LocalList(table string) ([]map[string]interface{}, error) {
	if a.sync == nil {
		return nil, fmt.Errorf("sync engine not initialized")
	}
	return a.sync.LocalList(table)
}

// Sync runs Pull (for the listed tables) then Push. Returns counts
// for the UI to render.
func (a *App) Sync(tables []string) (*sync.SyncResult, error) {
	if a.sync == nil {
		return nil, fmt.Errorf("sync engine not initialized")
	}
	return a.sync.Sync(tables)
}

// GetSyncTables returns the models covered by offline sync. The frontend uses
// this instead of a hardcoded list, so a newly generated resource is picked up
// automatically.
func (a *App) GetSyncTables() []string { return syncTables }

// SetOfflineMode toggles the manual "Work offline" switch shown in the
// dashboard. Turning it OFF (going back online) triggers an immediate
// background reconcile so queued edits push and fresh data pulls right away.
func (a *App) SetOfflineMode(offline bool) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	if err := a.sync.SetForceOffline(offline); err != nil {
		return err
	}
	if !offline {
		// Back online. If auto-sync is on, reconcile fully (pull + push queued
		// changes). If the user turned auto-sync off, only pull fresh data —
		// their queued changes wait for a manual confirm on the Pending tab.
		go func() {
			if a.sync.IsAutoSyncEnabled() {
				_, _ = a.sync.SyncNow()
			} else {
				_ = a.sync.PullAll(syncTables)
			}
		}()
	}
	return nil
}

// SetAutoSync toggles whether the app pushes queued changes automatically when
// it comes online (default) or waits for the user to confirm them manually.
func (a *App) SetAutoSync(enabled bool) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.SetAutoSync(enabled)
}

// ConfirmChange pushes a single queued change now — the per-row "Confirm"
// action used when auto-sync is off.
func (a *App) ConfirmChange(table, entityID string) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	_, _, err := a.sync.PushOne(table, entityID)
	return err
}

// RevertChange discards one queued change and restores server state for it.
func (a *App) RevertChange(table, entityID string) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.RevertChange(table, entityID)
}

// RevertAll discards every queued change and restores server state.
func (a *App) RevertAll() error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.RevertAll()
}

// GetSyncStatus returns the reachable/offline/pending snapshot for the
// dashboard indicator.
func (a *App) GetSyncStatus() sync.SyncStatus {
	if a.sync == nil {
		return sync.SyncStatus{}
	}
	return a.sync.Status()
}

// SyncNow forces an immediate Pull+Push (the dashboard "Sync now" action).
func (a *App) SyncNow() (*sync.SyncResult, error) {
	if a.sync == nil {
		return nil, fmt.Errorf("sync engine not initialized")
	}
	return a.sync.SyncNow()
}

// PendingCount returns the number of unpushed entries — wired to the
// title-bar Sync button badge.
func (a *App) PendingCount() (int64, error) {
	if a.sync == nil {
		return 0, nil
	}
	return a.sync.PendingCount()
}

// GetPendingChanges returns the full outbox for the review panel.
func (a *App) GetPendingChanges() ([]sync.Outbox, error) {
	if a.sync == nil {
		return nil, fmt.Errorf("sync engine not initialized")
	}
	return a.sync.GetPendingChanges()
}

// ResolveConflict accepts the user's merged data for a conflicted entry.
// serverVersion is the version the user is overwriting (so the next
// push's optimistic-lock check matches). The engine clears HasConflict
// so the entry is replayed on the next Sync.
func (a *App) ResolveConflict(table, entityID string, mergedData map[string]interface{}, serverVersion int) error {
	if a.sync == nil {
		return fmt.Errorf("sync engine not initialized")
	}
	return a.sync.ResolveConflict(table, entityID, mergedData, serverVersion)
}
