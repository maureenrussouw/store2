package sync

import (
	gosync "sync"
)

// Record is one row in the local mirror — the cache reads come from.
// Model holds the logical table name ("buildings"); the physical
// SQLite table is "sync_records" (set via TableName below).
type Record struct {
	Model     string `gorm:"primaryKey;size:50"`
	ID        string `gorm:"primaryKey;size:36"`
	Data      []byte `gorm:"type:blob"` // server JSON
	Version   int
	UpdatedAt int64 // unix seconds
	Deleted   bool
}

func (Record) TableName() string { return "sync_records" }

// Outbox is one pending local change. Squashed: at most one row per
// (table_name, entity_id), enforced by a UNIQUE index.
//
// Op is "create" / "update" / "delete". Version is the server version
// the local change is based on — sent as the optimistic-lock check on push.
//
// HasConflict + ServerData/ServerVersion populated when /api/sync/push
// returned VERSION_CONFLICT. The UI builds a per-field merge dialog
// from these and calls ResolveConflict() to clear them.
type Outbox struct {
	ID            int64  `gorm:"primaryKey;autoIncrement"`
	Model         string `gorm:"size:50;uniqueIndex:idx_outbox_entity"`
	EntityID      string `gorm:"size:36;uniqueIndex:idx_outbox_entity"`
	Op            string `gorm:"size:10"`
	Data          []byte `gorm:"type:blob"`
	Version       int
	CreatedAt     int64
	HasConflict   bool
	ServerData    []byte `gorm:"type:blob"`
	ServerVersion int
	ConflictMsg   string `gorm:"size:500"`
}

func (Outbox) TableName() string { return "sync_outbox" }

// Cursor stores the last pull timestamp per model.
type Cursor struct {
	Model string `gorm:"primaryKey;size:50"`
	Value string `gorm:"size:50"` // RFC3339Nano
}

func (Cursor) TableName() string { return "sync_cursors" }

var enqueueMu gosync.Mutex

// enqueue applies squash semantics:
//   - new "create" + no entry            → INSERT create
//   - new "update" + existing create     → UPDATE the create's data
//   - new "update" + existing update     → UPDATE data
//   - new "delete" + existing create     → DELETE outbox row (never made it to server)
//   - new "delete" + existing update     → flip to delete, drop data
//   - new "delete" + no entry            → INSERT delete
func enqueue(e *Engine, table, id, op string, data []byte, version int) error {
	enqueueMu.Lock()
	defer enqueueMu.Unlock()

	var existing Outbox
	err := e.DB.Where("model = ? AND entity_id = ?", table, id).First(&existing).Error
	switch {
	case err == nil:
		switch {
		case op == "delete" && existing.Op == "create":
			// Squashed away — both ends cancel.
			return e.DB.Delete(&existing).Error
		case op == "delete":
			return e.DB.Model(&existing).Updates(map[string]interface{}{
				"op":           "delete",
				"data":         nil,
				"has_conflict": false,
			}).Error
		default:
			// Update or upgrade: keep original op, refresh data.
			return e.DB.Model(&existing).Updates(map[string]interface{}{
				"data":         data,
				"has_conflict": false,
			}).Error
		}
	default:
		// New entry.
		entry := Outbox{
			Model:     table,
			EntityID:  id,
			Op:        op,
			Data:      data,
			Version:   version,
			CreatedAt: nowUnix(),
		}
		return e.DB.Create(&entry).Error
	}
}
