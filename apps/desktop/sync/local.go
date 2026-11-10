package sync

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"store2/apps/desktop/internal/ids"
)

var slugNonWord = regexp.MustCompile("[^a-z0-9]+")

// clientSlug builds a slug from a source string so a freshly-created row shows
// a slug immediately, before the authoritative server value syncs back.
func clientSlug(s string) string {
	out := slugNonWord.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-")
	return strings.Trim(out, "-")
}

// LocalCreate persists data locally and queues a "create" entry in the
// outbox. id is required (UUID); pass ids.New() if you don't
// have one yet. Reads via LocalGet/LocalList see the new row immediately.
func (e *Engine) LocalCreate(tableName, id string, data map[string]interface{}) error {
	if id == "" {
		id = ids.New()
	}
	data["id"] = id
	if data["version"] == nil {
		data["version"] = 0
	}
	// Populate server-computed fields optimistically so the table doesn't show
	// blanks until the first pull. The server remains authoritative: its real
	// created_at / slug overwrite these on the next sync.
	now := time.Now().UTC().Format(time.RFC3339)
	if v, ok := data["created_at"].(string); !ok || v == "" {
		data["created_at"] = now
	}
	if v, ok := data["updated_at"].(string); !ok || v == "" {
		data["updated_at"] = now
	}
	if v, ok := data["slug"].(string); !ok || v == "" {
		for _, src := range []string{"name", "title"} {
			if s, ok := data[src].(string); ok && s != "" {
				data["slug"] = clientSlug(s)
				break
			}
		}
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if err := e.DB.Save(&Record{
		Model:     tableName,
		ID:        id,
		Data:      raw,
		Version:   0,
		UpdatedAt: nowUnix(),
	}).Error; err != nil {
		return err
	}
	return enqueue(e, tableName, id, "create", raw, 0)
}

// LocalUpdate merges data into the existing local row and queues an
// "update" in the outbox. Errors if the row is missing.
func (e *Engine) LocalUpdate(tableName, id string, data map[string]interface{}) error {
	var rec Record
	if err := e.DB.First(&rec, "model = ? AND id = ?", tableName, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("local update: %s/%s not found", tableName, id)
		}
		return err
	}
	current := map[string]interface{}{}
	_ = json.Unmarshal(rec.Data, &current)
	for k, v := range data {
		current[k] = v
	}
	current["id"] = id
	raw, err := json.Marshal(current)
	if err != nil {
		return err
	}
	if err := e.DB.Model(&rec).Updates(map[string]interface{}{
		"data":       raw,
		"updated_at": nowUnix(),
	}).Error; err != nil {
		return err
	}
	return enqueue(e, tableName, id, "update", raw, rec.Version)
}

// LocalDelete soft-deletes from the local mirror and queues a "delete"
// in the outbox. The mirror row is removed too so reads stop seeing it.
func (e *Engine) LocalDelete(tableName, id string) error {
	var rec Record
	err := e.DB.First(&rec, "model = ? AND id = ?", tableName, id).Error
	knownVersion := 0
	if err == nil {
		knownVersion = rec.Version
		e.DB.Delete(&rec)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return enqueue(e, tableName, id, "delete", nil, knownVersion)
}

// LocalGet returns the cached record decoded from JSON, or nil if missing or
// tombstoned (deleted locally or via a pulled server delete).
func (e *Engine) LocalGet(tableName, id string) (map[string]interface{}, error) {
	var rec Record
	if err := e.DB.First(&rec, "model = ? AND id = ? AND deleted = ?", tableName, id, false).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	out := map[string]interface{}{}
	if err := json.Unmarshal(rec.Data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// LocalList returns every cached record for tableName, decoded. The
// caller can filter / sort in memory; for an MVP we don't push
// SQL-shaped queries through to SQLite.
func (e *Engine) LocalList(tableName string) ([]map[string]interface{}, error) {
	var rows []Record
	if err := e.DB.Where("model = ? AND deleted = ?", tableName, false).Order("updated_at desc").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(rows))
	for _, r := range rows {
		m := map[string]interface{}{}
		if err := json.Unmarshal(r.Data, &m); err == nil {
			out = append(out, m)
		}
	}
	return out, nil
}

func nowUnix() int64 { return time.Now().Unix() }
