// Package sync is the offline-first engine for the desktop app.
//
// Data model:
//   - records — local mirror of every row the user has touched. Reads
//     come from this table; pulls UPSERT into it.
//   - outbox  — pending local changes that haven't been pushed yet.
//     One entry per (table_name, entity_id) — multiple edits squash.
//
// Wire flow:
//   - LocalCreate/Update/Delete writes both records (so reads see the
//     change immediately) AND an outbox entry.
//   - Sync() runs Pull then Push:
//     Pull updates records from /api/sync/pull?model=X&since=...
//     Push posts the outbox to /api/sync/push and applies results.
//   - Conflicts surface as outbox rows with HasConflict=true so the UI
//     can present a per-field merge dialog. ResolveConflict(...) writes
//     the merged data back into the outbox and clears the flag.
package sync

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	gosync "sync"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"store2/apps/desktop/internal/ids"
)

// Engine owns the local SQLite database and the HTTP transport used to
// talk to /api/sync. One Engine per running app.
type Engine struct {
	DB        *gorm.DB
	APIURL    string
	GetToken  func() (string, error)
	HTTP      *http.Client
	cursors   map[string]string // last pull cursor per model
	cursorsMu gosync.RWMutex

	// Background auto-sync state (offline-hybrid UX).
	autoMu     gosync.Mutex
	stopAuto   chan struct{}
	syncModels []string
	lastSync   time.Time
	lastErr    string
	online     bool
	deviceID   string
	syncingN   int // >0 while a pull/push is in flight (drives the UI spinner)
}

// Open initializes a sync engine. dbPath is the absolute path to the
// SQLite file; apiURL is the base API URL ending in "/api". getToken
// returns the user's current bearer token (called per request).
func Open(dbPath, apiURL string, getToken func() (string, error)) (*Engine, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("creating data dir: %w", err)
	}
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("opening local db: %w", err)
	}
	if err := db.AutoMigrate(&Record{}, &Outbox{}, &Cursor{}, &Setting{}); err != nil {
		return nil, fmt.Errorf("migrating local db: %w", err)
	}
	e := &Engine{
		DB:       db,
		APIURL:   apiURL,
		GetToken: getToken,
		HTTP:     &http.Client{Timeout: 30 * time.Second},
		cursors:  make(map[string]string),
	}
	// A stable per-install device id, generated once and persisted. Shown on
	// the Sync page and useful for correlating a device's changes server-side.
	e.deviceID = e.getSetting("device_id")
	if e.deviceID == "" {
		e.deviceID = ids.New()
		_ = e.setSetting("device_id", e.deviceID)
	}
	return e, nil
}

// SyncResult summarizes one Sync run for the UI.
//
// StartedAt/FinishedAt are RFC3339 strings, not time.Time. This struct crosses
// the Wails boundary, and Wails' TypeScript binding generator cannot resolve
// time.Time ("Not found: time.Time") — it then drops the models AND every App
// method that mentions them, so the frontend loses Sync/LocalCreate/... The
// JSON shape is identical either way (time.Time already marshals to RFC3339).
type SyncResult struct {
	Pushed     int      `json:"pushed"`
	Pulled     int      `json:"pulled"`
	Conflicts  int      `json:"conflicts"`
	Errors     []string `json:"errors,omitempty"`
	StartedAt  string   `json:"started_at"`
	FinishedAt string   `json:"finished_at"`
}

// Sync runs Pull → Push. Pull first so the user pushes against the
// freshest server state and conflict surface area is minimized. Models
// is the list of table names to pull; pass empty to skip pull.
func (e *Engine) Sync(models []string) (*SyncResult, error) {
	e.setSyncing(true)
	defer e.setSyncing(false)
	res := &SyncResult{StartedAt: time.Now().Format(time.RFC3339)}

	for _, m := range models {
		n, err := e.Pull(m)
		if err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("pull %s: %v", m, err))
			continue
		}
		res.Pulled += n
	}

	pushed, conflicts, err := e.Push()
	if err != nil {
		res.Errors = append(res.Errors, fmt.Sprintf("push: %v", err))
	}
	res.Pushed = pushed
	res.Conflicts = conflicts
	res.FinishedAt = time.Now().Format(time.RFC3339)
	return res, nil
}

// PullAll refreshes the local mirror for every model without pushing. Used by
// the background loop (and the go-online transition) when auto-sync is off:
// server data stays fresh, but queued local changes wait for manual confirm.
func (e *Engine) PullAll(models []string) error {
	e.setSyncing(true)
	defer e.setSyncing(false)
	var firstErr error
	for _, m := range models {
		if _, err := e.Pull(m); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// Setting is a tiny key/value table for engine flags that must survive an app
// restart — currently just the manual "Work offline" toggle.
type Setting struct {
	Key   string `gorm:"primarykey"`
	Value string
}

func (Setting) TableName() string { return "sync_settings" }

func (e *Engine) getSetting(key string) string {
	var s Setting
	if err := e.DB.First(&s, "key = ?", key).Error; err != nil {
		return ""
	}
	return s.Value
}

func (e *Engine) setSetting(key, value string) error {
	return e.DB.Save(&Setting{Key: key, Value: value}).Error
}

// SetForceOffline persists the manual "Work offline" toggle. While on, the
// background loop stops syncing and every write just queues locally; flip it
// back off and the next tick (or SyncNow) reconciles.
func (e *Engine) SetForceOffline(v bool) error {
	val := "0"
	if v {
		val = "1"
	}
	return e.setSetting("force_offline", val)
}

// IsForceOffline reports the persisted manual-offline toggle.
func (e *Engine) IsForceOffline() bool { return e.getSetting("force_offline") == "1" }

// SetAutoSync persists the "auto-sync when online" preference. When ON (the
// default) the background loop pushes queued changes automatically the moment
// the server is reachable. When OFF, the loop still pulls fresh server data but
// leaves local changes in the outbox for the user to confirm manually.
func (e *Engine) SetAutoSync(v bool) error {
	val := "0"
	if v {
		val = "1"
	}
	return e.setSetting("auto_sync", val)
}

// IsAutoSyncEnabled reports the auto-sync preference. Defaults to ON when the
// setting has never been written (empty string) so a fresh install keeps the
// familiar "just works" behaviour.
func (e *Engine) IsAutoSyncEnabled() bool { return e.getSetting("auto_sync") != "0" }

// setSyncing bumps/decrements the in-flight counter that drives the UI spinner.
// A counter (not a bool) keeps it correct when a manual Sync overlaps a tick.
func (e *Engine) setSyncing(on bool) {
	e.autoMu.Lock()
	if on {
		e.syncingN++
	} else if e.syncingN > 0 {
		e.syncingN--
	}
	e.autoMu.Unlock()
}

// Reachable pings /api/health to tell "the server is down / no network" apart
// from "the user chose offline". Short timeout so the UI stays responsive.
func (e *Engine) Reachable() bool {
	req, err := http.NewRequest(http.MethodGet, e.APIURL+"/health", nil)
	if err != nil {
		return false
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode < 500
}

// StartAutoSync launches the background mirror loop: every interval, if the
// server is reachable AND the user hasn't chosen offline, it runs Sync (Pull
// then Push). This is what continuously mirrors server data locally while
// online, and what auto-reconciles offline edits the moment you're back on.
// Safe to call once at startup; a second call is a no-op.
func (e *Engine) StartAutoSync(models []string, interval time.Duration) {
	e.autoMu.Lock()
	if e.stopAuto != nil {
		e.autoMu.Unlock()
		return
	}
	stop := make(chan struct{})
	e.stopAuto = stop
	e.syncModels = models
	e.autoMu.Unlock()

	go func() {
		e.tick() // sync shortly after startup so the mirror is fresh
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-stop:
				return
			case <-t.C:
				e.tick()
			}
		}
	}()
}

// StopAutoSync stops the background loop (call on shutdown).
func (e *Engine) StopAutoSync() {
	e.autoMu.Lock()
	if e.stopAuto != nil {
		close(e.stopAuto)
		e.stopAuto = nil
	}
	e.autoMu.Unlock()
}

// tick is one iteration of the background loop.
func (e *Engine) tick() {
	reachable := e.Reachable()
	e.autoMu.Lock()
	e.online = reachable
	models := e.syncModels
	e.autoMu.Unlock()

	if e.IsForceOffline() || !reachable {
		return
	}

	var err error
	if e.IsAutoSyncEnabled() {
		// Full reconcile: pull fresh data and push queued local changes.
		_, err = e.Sync(models)
	} else {
		// Auto-sync off: keep the mirror fresh but never push automatically —
		// the user confirms queued changes by hand from the Pending tab.
		err = e.PullAll(models)
	}

	e.autoMu.Lock()
	if err != nil {
		e.lastErr = err.Error()
	} else {
		e.lastErr = ""
		e.lastSync = time.Now()
	}
	e.autoMu.Unlock()
}

// SyncNow forces an immediate Pull+Push (used when the user flips back online).
func (e *Engine) SyncNow() (*SyncResult, error) {
	if e.IsForceOffline() {
		return nil, fmt.Errorf("offline mode is on")
	}
	e.autoMu.Lock()
	models := e.syncModels
	e.autoMu.Unlock()
	res, err := e.Sync(models)
	e.autoMu.Lock()
	if err == nil {
		e.lastSync = time.Now()
		e.lastErr = ""
	}
	e.autoMu.Unlock()
	return res, err
}

// SyncStatus is the snapshot the dashboard/title-bar shows.
type SyncStatus struct {
	Reachable    bool     `json:"reachable"`
	ForceOffline bool     `json:"force_offline"`
	AutoSync     bool     `json:"auto_sync"`
	Syncing      bool     `json:"syncing"`
	Pending      int64    `json:"pending"`
	LastSync     string   `json:"last_sync,omitempty"`
	LastError    string   `json:"last_error,omitempty"`
	DeviceID     string   `json:"device_id,omitempty"`
	Tables       []string `json:"tables,omitempty"`
}

// Status returns the current sync snapshot. Reachability comes from the last
// background tick (no extra network call on every poll).
func (e *Engine) Status() SyncStatus {
	pending, _ := e.PendingCount()
	e.autoMu.Lock()
	ls := ""
	if !e.lastSync.IsZero() {
		ls = e.lastSync.Format(time.RFC3339)
	}
	st := SyncStatus{
		Reachable:    e.online,
		ForceOffline: e.IsForceOffline(),
		AutoSync:     e.IsAutoSyncEnabled(),
		Syncing:      e.syncingN > 0,
		Pending:      pending,
		LastSync:     ls,
		LastError:    e.lastErr,
		DeviceID:     e.deviceID,
		Tables:       e.syncModels,
	}
	e.autoMu.Unlock()
	return st
}

// Pull fetches every row in modelName updated after our last cursor
// and UPSERTs them into local records. Returns the number of rows seen.
func (e *Engine) Pull(modelName string) (int, error) {
	since := e.getCursor(modelName)
	url := fmt.Sprintf("%s/sync/pull?model=%s", e.APIURL, modelName)
	if since != "" {
		url += "&since=" + since
	}

	body, err := e.doGET(url)
	if err != nil {
		return 0, err
	}

	var resp struct {
		Data   []map[string]interface{} `json:"data"`
		Cursor string                   `json:"cursor"`
		Count  int                      `json:"count"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, fmt.Errorf("decoding pull response: %w", err)
	}

	for _, row := range resp.Data {
		id, _ := row["id"].(string)
		if id == "" {
			continue
		}
		version, _ := toInt(row["version"])
		deleted, _ := row["_deleted"].(bool)
		raw, err := json.Marshal(row)
		if err != nil {
			continue
		}
		updatedAt := time.Now().Unix()
		if u, ok := row["updated_at"].(string); ok {
			if t, err := time.Parse(time.RFC3339Nano, u); err == nil {
				updatedAt = t.Unix()
			}
		}
		rec := Record{
			Model:     modelName,
			ID:        id,
			Data:      raw,
			Version:   version,
			UpdatedAt: updatedAt,
			// A server-side delete arrives as a tombstone — mark the mirror
			// row deleted so reads (LocalList/LocalGet) hide it. We keep the
			// row rather than hard-deleting so a later re-create still upserts.
			Deleted: deleted,
		}
		// UPSERT: pulled state always wins over the cached version.
		if err := e.DB.Save(&rec).Error; err != nil {
			return 0, err
		}
	}
	if resp.Cursor != "" {
		e.setCursor(modelName, resp.Cursor)
	}
	return resp.Count, nil
}

// MaxPushChanges is the most changes the server takes in one push.
const MaxPushChanges = 500

// PushBatch is the JSON shape /api/sync/push expects.
type PushBatch struct {
	Changes []PushChange `json:"changes"`
}

// PushChange mirrors the server's PushChange.
type PushChange struct {
	Op      string                 `json:"op"`
	Model   string                 `json:"model"`
	ID      string                 `json:"id"`
	Version int                    `json:"version"`
	Data    map[string]interface{} `json:"data"`
}

// PushResult mirrors the server's PushResult.
type PushResult struct {
	OK            bool                   `json:"ok"`
	Code          string                 `json:"code,omitempty"`
	Message       string                 `json:"message,omitempty"`
	ServerVersion int                    `json:"server_version,omitempty"`
	ServerData    map[string]interface{} `json:"server_data,omitempty"`
	NewVersion    int                    `json:"new_version,omitempty"`
}

// Push drains the outbox into a single /api/sync/push call and applies
// each per-entry result. Successful entries are removed from the outbox
// and the local record is marked synced. Conflicts stay in the outbox
// with HasConflict=true and the server state attached so the UI can
// drive a merge dialog.
//
// Returns (pushed, conflicts, err).
func (e *Engine) Push() (int, int, error) {
	// Skip rows that already have an unresolved conflict — the user has
	// to resolve those via ResolveConflict before they're tried again.
	var entries []Outbox
	if err := e.DB.Where("has_conflict = 0").Order("created_at asc").Find(&entries).Error; err != nil {
		return 0, 0, err
	}
	// The server takes at most MaxPushChanges a push, so a long offline stretch
	// goes up in several.
	pushed, conflicts := 0, 0
	for start := 0; start < len(entries); start += MaxPushChanges {
		end := start + MaxPushChanges
		if end > len(entries) {
			end = len(entries)
		}
		p, c, err := e.pushEntries(entries[start:end])
		pushed += p
		conflicts += c
		if err != nil {
			return pushed, conflicts, err
		}
	}
	return pushed, conflicts, nil
}

// PushOne pushes a single queued change immediately. Used by the "Confirm"
// action on the Pending tab when auto-sync is off, so the user can approve
// changes one at a time. Returns (pushed, conflicts, err).
func (e *Engine) PushOne(table, entityID string) (int, int, error) {
	var entry Outbox
	if err := e.DB.Where("model = ? AND entity_id = ? AND has_conflict = 0", table, entityID).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, 0, fmt.Errorf("no pending change for %s/%s", table, entityID)
		}
		return 0, 0, err
	}
	e.setSyncing(true)
	defer e.setSyncing(false)
	return e.pushEntries([]Outbox{entry})
}

// pushEntries posts a specific set of outbox rows to /api/sync/push and applies
// each per-entry result. Shared by Push (drain the whole outbox) and PushOne
// (confirm a single change). Successful entries are removed; conflicts are kept
// with the server state attached for the merge dialog.
func (e *Engine) pushEntries(entries []Outbox) (int, int, error) {
	if len(entries) == 0 {
		return 0, 0, nil
	}

	batch := PushBatch{Changes: make([]PushChange, 0, len(entries))}
	for _, en := range entries {
		var data map[string]interface{}
		if len(en.Data) > 0 {
			_ = json.Unmarshal(en.Data, &data)
		}
		batch.Changes = append(batch.Changes, PushChange{
			Op:      en.Op,
			Model:   en.Model,
			ID:      en.EntityID,
			Version: en.Version,
			Data:    data,
		})
	}

	body, err := e.doPOST(e.APIURL+"/sync/push", batch)
	if err != nil {
		return 0, 0, err
	}

	var resp struct {
		Results []PushResult `json:"results"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return 0, 0, fmt.Errorf("decoding push response: %w", err)
	}
	if len(resp.Results) != len(entries) {
		return 0, 0, fmt.Errorf("push: server returned %d results for %d changes", len(resp.Results), len(entries))
	}

	pushed := 0
	conflicts := 0
	for i, r := range resp.Results {
		en := entries[i]
		switch {
		case r.OK:
			// Remove the outbox entry; mark the local record at the new version.
			if err := e.DB.Delete(&en).Error; err != nil {
				return pushed, conflicts, err
			}
			if en.Op == "delete" {
				e.DB.Where("model = ? AND id = ?", en.Model, en.EntityID).Delete(&Record{})
			} else {
				e.DB.Model(&Record{}).
					Where("model = ? AND id = ?", en.Model, en.EntityID).
					Updates(map[string]interface{}{"version": r.NewVersion})
			}
			pushed++

		case r.Code == "VERSION_CONFLICT":
			// Stash the server state on the outbox row for the UI.
			serverDataJSON, _ := json.Marshal(r.ServerData)
			e.DB.Model(&en).Updates(map[string]interface{}{
				"has_conflict":   true,
				"server_data":    serverDataJSON,
				"server_version": r.ServerVersion,
				"conflict_msg":   r.Message,
			})
			conflicts++

		default:
			// Other errors leave the entry alone; user can retry later.
			e.DB.Model(&en).Update("conflict_msg", fmt.Sprintf("%s: %s", r.Code, r.Message))
		}
	}
	return pushed, conflicts, nil
}

// ResolveConflict accepts the user's merge for one conflicted entity.
// mergedData becomes the new outbox payload; serverVersion is the
// version the user is overwriting (so the next push uses If-Match
// semantics correctly). Clears HasConflict so the entry is replayed
// on the next Push.
func (e *Engine) ResolveConflict(tableName, entityID string, mergedData map[string]interface{}, serverVersion int) error {
	dataJSON, err := json.Marshal(mergedData)
	if err != nil {
		return err
	}
	res := e.DB.Model(&Outbox{}).
		Where("model = ? AND entity_id = ?", tableName, entityID).
		Updates(map[string]interface{}{
			"data":           dataJSON,
			"version":        serverVersion,
			"has_conflict":   false,
			"server_data":    nil,
			"server_version": 0,
			"conflict_msg":   "",
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("no outbox entry for %s:%s", tableName, entityID)
	}
	// Also update the local record so reads see the merged state immediately.
	return e.DB.Model(&Record{}).
		Where("model = ? AND id = ?", tableName, entityID).
		Updates(map[string]interface{}{"data": dataJSON, "version": serverVersion}).Error
}

// RevertChange discards one queued local change and realigns the local mirror
// with the server:
//
//   - create: the row never reached the server, so drop the outbox entry AND
//     the local-only mirror row — the item disappears (which is correct: the
//     user is undoing a creation that was never persisted anywhere else).
//   - update / delete: drop the outbox entry and rewind the model's pull cursor
//     so the authoritative server row is re-fetched. If we're online, pull now
//     so the UI reflects server truth immediately; otherwise it reconciles on
//     the next successful pull.
func (e *Engine) RevertChange(table, entityID string) error {
	var entry Outbox
	if err := e.DB.Where("model = ? AND entity_id = ?", table, entityID).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // already gone — nothing to revert
		}
		return err
	}
	if err := e.DB.Delete(&entry).Error; err != nil {
		return err
	}
	if entry.Op == "create" {
		return e.DB.Where("model = ? AND id = ?", table, entityID).Delete(&Record{}).Error
	}
	e.resetCursor(table)
	if !e.IsForceOffline() && e.Reachable() {
		e.setSyncing(true)
		_, _ = e.Pull(table)
		e.setSyncing(false)
	}
	return nil
}

// RevertAll discards every queued change and realigns the mirror with the
// server. Used by "Discard all" on the Pending tab.
func (e *Engine) RevertAll() error {
	var entries []Outbox
	if err := e.DB.Find(&entries).Error; err != nil {
		return err
	}
	models := map[string]bool{}
	for _, en := range entries {
		if en.Op == "create" {
			e.DB.Where("model = ? AND id = ?", en.Model, en.EntityID).Delete(&Record{})
		}
		models[en.Model] = true
	}
	if err := e.DB.Where("1 = 1").Delete(&Outbox{}).Error; err != nil {
		return err
	}
	for m := range models {
		e.resetCursor(m)
	}
	if !e.IsForceOffline() && e.Reachable() {
		e.setSyncing(true)
		for m := range models {
			_, _ = e.Pull(m)
		}
		e.setSyncing(false)
	}
	return nil
}

// PendingCount returns how many outbox entries are waiting (used to
// drive the title-bar badge).
func (e *Engine) PendingCount() (int64, error) {
	var n int64
	err := e.DB.Model(&Outbox{}).Count(&n).Error
	return n, err
}

// GetPendingChanges returns every outbox entry, oldest first, for the
// "review what's about to push" panel.
func (e *Engine) GetPendingChanges() ([]Outbox, error) {
	var entries []Outbox
	err := e.DB.Order("created_at asc").Find(&entries).Error
	return entries, err
}

func (e *Engine) doGET(url string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if err := e.attachAuth(req); err != nil {
		return nil, err
	}
	return e.do(req)
}

func (e *Engine) doPOST(url string, payload interface{}) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if err := e.attachAuth(req); err != nil {
		return nil, err
	}
	return e.do(req)
}

func (e *Engine) attachAuth(req *http.Request) error {
	if e.GetToken == nil {
		return nil
	}
	tok, err := e.GetToken()
	if err != nil {
		return err
	}
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	return nil
}

func (e *Engine) do(req *http.Request) ([]byte, error) {
	resp, err := e.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("api %s: %d: %s", req.URL.Path, resp.StatusCode, string(body))
	}
	return body, nil
}

func (e *Engine) getCursor(model string) string {
	e.cursorsMu.RLock()
	c, ok := e.cursors[model]
	e.cursorsMu.RUnlock()
	if ok {
		return c
	}
	var row Cursor
	if err := e.DB.First(&row, "model = ?", model).Error; err == nil {
		e.cursorsMu.Lock()
		e.cursors[model] = row.Value
		e.cursorsMu.Unlock()
		return row.Value
	}
	return ""
}

func (e *Engine) setCursor(model, value string) {
	e.cursorsMu.Lock()
	e.cursors[model] = value
	e.cursorsMu.Unlock()
	e.DB.Save(&Cursor{Model: model, Value: value})
}

// resetCursor forgets the pull cursor for a model so the next Pull re-fetches
// it from the beginning — used by RevertChange/RevertAll to pull authoritative
// server state back over a discarded local edit.
func (e *Engine) resetCursor(model string) {
	e.cursorsMu.Lock()
	delete(e.cursors, model)
	e.cursorsMu.Unlock()
	e.DB.Where("model = ?", model).Delete(&Cursor{})
}

func toInt(v interface{}) (int, bool) {
	switch x := v.(type) {
	case float64:
		return int(x), true
	case int:
		return x, true
	case int64:
		return int(x), true
	}
	return 0, false
}
