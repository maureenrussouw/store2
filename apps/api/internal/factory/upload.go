package factory

import (
	"fmt"
	"testing"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// NewUpload builds a valid Upload without saving it.
//
// UserID is left for CreateUpload to fill, because it cannot be filled without
// writing a row: see the note there.
func NewUpload(overrides ...func(*models.Upload)) *models.Upload {
	n := next()

	record := &models.Upload{
		Filename:     fmt.Sprintf("fixture-%d.png", n),
		OriginalName: fmt.Sprintf("Fixture %d.png", n),
		MimeType:     "image/png",
		Size:         int64(1024 * n),
		Path:         fmt.Sprintf("uploads/fixture-%d.png", n),
		URL:          fmt.Sprintf("http://localhost:8080/files/uploads/fixture-%d.png", n),
	}

	for _, apply := range overrides {
		apply(record)
	}
	return record
}

// CreateUpload builds one and writes it, failing the test if it will not save.
//
// Unlike a generated resource's factory, this one creates its parent. Upload's
// user_id is NOT NULL, so a fixture with an empty one is rejected by Postgres
// and the test fails on the insert rather than on anything it meant to assert.
// Pass a user to attach it to an existing one:
//
//	upload := factory.CreateUpload(t, db, func(u *models.Upload) {
//		u.UserID = owner.ID
//	})
func CreateUpload(tb testing.TB, db *gorm.DB, overrides ...func(*models.Upload)) *models.Upload {
	tb.Helper()
	record := NewUpload(overrides...)
	if record.UserID == "" {
		record.UserID = CreateUser(tb, db).ID
	}
	if err := db.Create(record).Error; err != nil {
		tb.Fatalf("creating an upload fixture: %v", err)
	}
	return record
}

// CreateUploads writes n of them, for a test about paging or sorting.
//
// They share one owner: n users for n uploads is rows nothing asked for, and a
// test that wants them apart passes a UserID.
func CreateUploads(tb testing.TB, db *gorm.DB, n int, overrides ...func(*models.Upload)) []*models.Upload {
	tb.Helper()
	owner := CreateUser(tb, db)
	out := make([]*models.Upload, 0, n)
	for i := 0; i < n; i++ {
		all := append([]func(*models.Upload){func(u *models.Upload) {
			u.UserID = owner.ID
		}}, overrides...)
		out = append(out, CreateUpload(tb, db, all...))
	}
	return out
}
