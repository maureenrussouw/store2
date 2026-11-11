package models

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/files"
	"store2/apps/api/internal/ids"
)

// Product represents a product in the system.
type Product struct {
	ID          string         `gorm:"primarykey;size:36" json:"id"`
	Name        string         `gorm:"size:255" json:"name" binding:"required" search:"trigram"`
	Slug        string         `gorm:"size:255;uniqueIndex" json:"slug" search:"trigram" slug:"name"`
	Price       int            `json:"price"`
	Description string         `gorm:"type:text" json:"description" search:"trigram"`
	Thumbnail   *files.FileRef `gorm:"type:json" json:"thumbnail"`
	Images      files.FileRefs `gorm:"type:json" json:"images"`
	CategoryID  string         `gorm:"size:36;index" json:"category_id" binding:"required"`
	Category    *Category      `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	ParentID    *string        `gorm:"size:36;index;default:null" json:"parent_id"`
	Parent      *Product       `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	// --- tree (grit --tree) ---------------------------------------------------
	// server:"true" on path, depth and position: all three are the tree
	// service's to write, and a create or update schema that asks for them
	// asks a form for a materialised path before the row has an id. The tag is
	// the one the slug and owner columns already use, read by inferField.
	// Children is a convenience for one level. The whole tree comes from the
	// service in a single query rather than a preload per level.
	Children []Product `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	// Path is "/id/id/id/", this row's id last, ids delimited on both sides so
	// a prefix match cannot half-match an id. Descendants are one indexed LIKE.
	// 700 characters, not more: MySQL indexes at most 3072 bytes, and utf8mb4
	// counts four per character, so an indexed varchar(1024) is 4096 bytes and
	// AutoMigrate refuses the table outright. 700 holds about eighteen levels of
	// uuid, which is deeper than a category or folder tree goes.
	Path string `gorm:"size:700;index" json:"path" server:"true"`
	// Depth is 0 for a root. Stored rather than counted from Path, because a
	// move can keep it correct with one delta and counting separators in SQL is
	// three expressions across three dialects.
	Depth int `gorm:"index" json:"depth" server:"true"`
	// Position orders siblings. Without it a tree renders in insertion order
	// and the admin's drag handles have nowhere to write.
	Position  int            `gorm:"index;default:0" json:"position" server:"true"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt time.Time      `gorm:"index" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	// ArchivedAt is the "put this away without destroying it" state, and it is
	// deliberately not DeletedAt. A soft delete is invisible to every query and
	// means the row is gone as far as the app is concerned; an archived row is
	// still listable, still exportable and still restorable in one click. The
	// list endpoint hides archived rows unless ?archived=true asks for them.
	ArchivedAt *time.Time `gorm:"index" json:"archived_at,omitempty"`
}

// BeforeCreate generates a UUID and auto-generates the slug before inserting.
func (m *Product) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = ids.New()
	}
	if m.Slug == "" {
		m.Slug = slugify(fmt.Sprintf("%v", m.Name))
	}
	// Materialized path, computed here because it needs the id assigned above.
	if err := m.resolveTreePath(tx); err != nil {
		return err
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Product) BeforeUpdate(tx *gorm.DB) error {
	tx.Statement.SetColumn("version", gorm.Expr("version + 1"))
	return nil
}

// resolveTreePath sets Path and Depth from the parent, and refuses a cycle.
//
// The cycle check is one string comparison: the parent's path contains every id
// above it, so if it contains this row's id then this row is being moved under
// its own descendant. Without the check, that move detaches a whole subtree
// from the tree and no query ever finds it again.
func (m *Product) resolveTreePath(tx *gorm.DB) error {
	// Absent is NULL, never "". A foreign key constraint accepts NULL and
	// rejects "", so an empty string here is an insert that fails on Postgres
	// and silently dangles on a database with constraints switched off.
	if m.ParentID != nil && *m.ParentID == "" {
		m.ParentID = nil
	}
	if m.ParentID == nil {
		m.Path = "/" + m.ID + "/"
		m.Depth = 0
		return nil
	}
	if *m.ParentID == m.ID {
		return fmt.Errorf("a product cannot be its own parent")
	}

	var parent Product
	// NewDB so this lookup does not inherit the conditions of the statement
	// being built, which would silently scope it to the row being written.
	err := tx.Session(&gorm.Session{NewDB: true}).
		Select("id", "path", "depth").
		Where("id = ?", *m.ParentID).
		First(&parent).Error
	if err != nil {
		return fmt.Errorf("parent %s does not exist: %w", *m.ParentID, err)
	}
	if m.ID != "" && strings.Contains(parent.Path, "/"+m.ID+"/") {
		return fmt.Errorf("cannot move a product under its own descendant")
	}

	m.Path = parent.Path + m.ID + "/"
	m.Depth = parent.Depth + 1
	return nil
}

// IsRoot reports whether this node sits at the top of the tree.
func (m *Product) IsRoot() bool { return m.ParentID == nil || *m.ParentID == "" }

// AncestorIDs returns the ids above this node, outermost first, read straight
// from the path. No query: that is the point of storing it.
func (m *Product) AncestorIDs() []string {
	parts := strings.Split(strings.Trim(m.Path, "/"), "/")
	if len(parts) <= 1 {
		return nil
	}
	return parts[:len(parts)-1] // everything except this node
}
