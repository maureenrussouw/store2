package services

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"store2/apps/api/internal/models"
)

// CategoryTreeService answers the questions a hierarchy is for.
//
// Every query here is one round trip. A tree rendered by walking parents is the
// N+1 that makes people give up on hierarchies.
//
// Each method takes the context it runs in, so a query carries the
// organization the multitenant plugin resolved: without it, the plugin
// refuses the query outright.
type CategoryTreeService struct {
	DB *gorm.DB
}

func NewCategoryTreeService(db *gorm.DB) *CategoryTreeService {
	return &CategoryTreeService{DB: db}
}

// db binds the database to ctx, so whatever a middleware put there reaches
// GORM's callbacks.
func (s *CategoryTreeService) db(ctx context.Context) *gorm.DB {
	return s.DB.WithContext(ctx)
}

// categoryParentOf looks a row's parent up in the node map, treating NULL and ""
// alike as "no parent". Both appear in real data: NULL from a root written
// today, "" from a row written before the column was nullable.
//
// Named after the resource because every tree service lands in package
// services, and a second tree resource in the same project would otherwise
// collide on a package-level parentOf.
func categoryParentOf(byID map[string]*CategoryNode, parentID *string) (*CategoryNode, bool) {
	if parentID == nil || *parentID == "" {
		return nil, false
	}
	node, ok := byID[*parentID]
	return node, ok
}

// CategoryNode is a category with its children attached, for rendering a tree.
type CategoryNode struct {
	models.Category
	Children []*CategoryNode `json:"children"`
}

// Tree returns the whole hierarchy in ONE query, assembled in Go.
//
// Ordered by depth so a parent is always seen before its children, then by
// position and name so siblings come back in the order the admin arranged them.
func (s *CategoryTreeService) Tree(ctx context.Context) ([]*CategoryNode, error) {
	var rows []models.Category
	err := s.db(ctx).Where("archived_at IS NULL").
		Order("depth asc, position asc, name asc").
		Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("loading categories: %w", err)
	}

	byID := make(map[string]*CategoryNode, len(rows))
	roots := make([]*CategoryNode, 0)
	for i := range rows {
		node := &CategoryNode{Category: rows[i]}
		byID[node.ID] = node
	}
	// Depth order means a parent is already in the map when its child arrives.
	// A child whose parent is missing (archived, or deleted mid-read) is
	// promoted to a root rather than dropped: losing a subtree from a tree view
	// is worse than showing it slightly out of place.
	for i := range rows {
		node := byID[rows[i].ID]
		if parent, ok := categoryParentOf(byID, rows[i].ParentID); ok {
			parent.Children = append(parent.Children, node)
			continue
		}
		roots = append(roots, node)
	}
	return roots, nil
}

// Roots returns the top level only.
//
// NULL counts as no parent, not just the empty string. Adding --tree to a
// resource that already has rows is the normal case, and AutoMigrate fills the
// new column with NULL, so a query testing only for ” finds nothing at all.
func (s *CategoryTreeService) Roots(ctx context.Context) ([]models.Category, error) {
	var rows []models.Category
	err := s.db(ctx).Where("(parent_id = '' OR parent_id IS NULL) AND archived_at IS NULL").
		Order("position asc, name asc").
		Find(&rows).Error
	return rows, err
}

// Children returns one level below a node.
func (s *CategoryTreeService) Children(ctx context.Context, id string) ([]models.Category, error) {
	var rows []models.Category
	err := s.db(ctx).Where("parent_id = ? AND archived_at IS NULL", id).
		Order("position asc, name asc").
		Find(&rows).Error
	return rows, err
}

// Descendants returns everything below a node, at any depth, in one query.
//
// The LIKE is anchored at the start with a delimited prefix, so /1/ matches
// /1/2/ and /1/2/3/ and never /11/.
func (s *CategoryTreeService) Descendants(ctx context.Context, id string) ([]models.Category, error) {
	var node models.Category
	if err := s.db(ctx).Select("id", "path").Where("id = ?", id).First(&node).Error; err != nil {
		return nil, fmt.Errorf("category %s not found: %w", id, err)
	}
	var rows []models.Category
	err := s.db(ctx).Where("path LIKE ? AND id <> ? AND archived_at IS NULL", node.Path+"%", id).
		Order("depth asc, position asc, name asc").
		Find(&rows).Error
	return rows, err
}

// DescendantIDs returns the node's id plus every id below it, which is what a
// filter wants: "products in Electronics" means Electronics and everything
// under it.
func (s *CategoryTreeService) DescendantIDs(ctx context.Context, id string) ([]string, error) {
	var node models.Category
	if err := s.db(ctx).Select("id", "path").Where("id = ?", id).First(&node).Error; err != nil {
		return nil, fmt.Errorf("category %s not found: %w", id, err)
	}
	var ids []string
	err := s.db(ctx).Model(&models.Category{}).
		Where("path LIKE ? AND archived_at IS NULL", node.Path+"%").
		Pluck("id", &ids).Error
	return ids, err
}

// Breadcrumbs returns the path from the root down to and including this node.
//
// The ids come from the stored path, so this is one IN query however deep the
// tree is, and the result is re-sorted into path order because IN does not
// promise one.
func (s *CategoryTreeService) Breadcrumbs(ctx context.Context, id string) ([]models.Category, error) {
	var node models.Category
	if err := s.db(ctx).Where("id = ?", id).First(&node).Error; err != nil {
		return nil, fmt.Errorf("category %s not found: %w", id, err)
	}
	ids := strings.Split(strings.Trim(node.Path, "/"), "/")
	if len(ids) == 0 {
		return []models.Category{node}, nil
	}

	var rows []models.Category
	if err := s.db(ctx).Where("id IN ?", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	byID := make(map[string]models.Category, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
	}
	ordered := make([]models.Category, 0, len(ids))
	for _, wanted := range ids {
		if r, ok := byID[wanted]; ok {
			ordered = append(ordered, r)
		}
	}
	return ordered, nil
}

// Move reparents a node and carries its subtree with it.
//
// Three things have to happen together, which is why this is a transaction and
// not three calls:
//
//  1. The node gets its new parent, path and depth.
//  2. Every descendant's path is rewritten, because their paths embed the old
//     prefix. REPLACE is used rather than string surgery in Go: it is one
//     UPDATE, it exists on Postgres, MySQL and SQLite alike, and it cannot race
//     with a concurrent read the way read-modify-write can.
//  3. Every descendant's depth shifts by the same delta, because a subtree
//     keeps its shape when it moves.
//
// Refuses a move that would make the node its own ancestor. Without that check
// the subtree is detached from the tree and no query finds it again.
//
// newParentID nil keeps the parent the node has, which is a reorder among
// its siblings; a pointer to "" moves it to the root.
func (s *CategoryTreeService) Move(ctx context.Context, id string, newParentID *string, position int) error {
	if id == "" {
		return fmt.Errorf("id is required")
	}
	if newParentID != nil && *newParentID == id {
		return fmt.Errorf("a category cannot be its own parent")
	}

	return s.db(ctx).Transaction(func(tx *gorm.DB) error {
		var node models.Category
		if err := tx.Where("id = ?", id).First(&node).Error; err != nil {
			return fmt.Errorf("category %s not found: %w", id, err)
		}
		oldPath := node.Path
		oldDepth := node.Depth

		// No parent given: the node keeps the one it has. Read here, inside the
		// transaction, rather than by the caller beforehand, so a move that
		// lands in between cannot be undone by this one.
		parentID := ""
		if newParentID != nil {
			parentID = *newParentID
		} else if node.ParentID != nil {
			parentID = *node.ParentID
		}

		newPath := "/" + id + "/"
		newDepth := 0
		if parentID != "" {
			var parent models.Category
			if err := tx.Select("id", "path", "depth").Where("id = ?", parentID).First(&parent).Error; err != nil {
				return fmt.Errorf("parent %s does not exist: %w", parentID, err)
			}
			if strings.Contains(parent.Path, "/"+id+"/") {
				return fmt.Errorf("cannot move a category under its own descendant")
			}
			newPath = parent.Path + id + "/"
			newDepth = parent.Depth + 1
		}

		// nil, not "": the FK constraint accepts one and rejects the other.
		var parentValue any
		if parentID != "" {
			parentValue = parentID
		}
		err := tx.Model(&models.Category{}).Where("id = ?", id).Updates(map[string]any{
			"parent_id": parentValue,
			"path":      newPath,
			"depth":     newDepth,
			"position":  position,
		}).Error
		if err != nil {
			return fmt.Errorf("moving category: %w", err)
		}

		if oldPath == newPath {
			return nil // reordered among its siblings, nothing below it moved
		}
		// A node with no path has no subtree to rewrite, and asking anyway is
		// destructive rather than merely pointless: "" as a LIKE prefix matches
		// every row in the table, so the depth increment below lands on all of
		// them. That is not hypothetical. Dragging a category that predated
		// --tree added one to the depth of every category in the database, and
		// nothing looked wrong until somebody read the rows.
		//
		// A row without a path is a row that predates --tree. RebuildPaths is
		// what fixes those, and this row now has a correct path either way.
		if oldPath == "" {
			return nil
		}

		// The subtree. Excludes the node itself, which is already written.
		delta := newDepth - oldDepth
		return tx.Model(&models.Category{}).
			Where("path LIKE ? AND id <> ?", oldPath+"%", id).
			Updates(map[string]any{
				"path":  gorm.Expr("REPLACE(path, ?, ?)", oldPath, newPath),
				"depth": gorm.Expr("depth + ?", delta),
			}).Error
	})
}

// Reorder writes a new sibling order in one transaction, which is what a
// drag-and-drop tree sends: the ids of one parent's children, in order.
//
// The parent is part of the WHERE on purpose, so a stale client cannot reorder
// a node into a parent it no longer belongs to. It has to treat NULL as no
// parent, though: rows that predate --tree have a NULL parent_id, and
// "parent_id = ”" matched none of them. The reorder then returned 200 having
// updated nothing, which is the worst kind of bug, the one that looks like it
// worked.
func (s *CategoryTreeService) Reorder(ctx context.Context, parentID string, orderedIDs []string) error {
	return s.db(ctx).Transaction(func(tx *gorm.DB) error {
		for position, id := range orderedIDs {
			q := tx.Model(&models.Category{}).Where("id = ?", id)
			if parentID == "" {
				q = q.Where("(parent_id = '' OR parent_id IS NULL)")
			} else {
				q = q.Where("parent_id = ?", parentID)
			}
			// parent_id is normalised on the way past, so the next reorder of
			// this row has one thing to compare rather than two.
			//
			// Normalised to NULL, not to "". A foreign key constraint accepts
			// NULL for "no parent" and rejects an empty string, so normalising
			// the other way turned a reorder of root rows into
			// "FOREIGN KEY constraint failed" on every database that enforces
			// them.
			updates := map[string]any{"position": position}
			if parentID == "" {
				updates["parent_id"] = nil
			}
			if err := q.Updates(updates).Error; err != nil {
				return fmt.Errorf("reordering %s: %w", id, err)
			}
		}
		return nil
	})
}

// RebuildPaths recomputes every path and depth from parent_id alone.
//
// The escape hatch for a tree whose paths were written by a bulk import that
// went around the hooks, or one that predates --tree.
//
// Deliberately not SQL. The obvious version is an UPDATE per level joining each
// row to its parent, and it is a trap: string concatenation is || on Postgres
// and SQLite but CONCAT on MySQL, UPDATE aliasing differs, and the WHERE that
// decides "not yet computed" has to be exactly right or it rewrites every row
// on every pass and leaves the table worse than it found it. That is not a
// hypothetical, it is what the first version of this function did.
//
// So: one read, the arithmetic in Go, one UPDATE per row, all in a transaction.
// This runs rarely, on a table with hundreds of rows, and being obviously
// correct on all three dialects is worth more here than being fast.
func (s *CategoryTreeService) RebuildPaths(ctx context.Context) error {
	return s.db(ctx).Transaction(func(tx *gorm.DB) error {
		return s.rebuildPathsInGo(tx)
	})
}

func (s *CategoryTreeService) rebuildPathsInGo(tx *gorm.DB) error {
	var rows []models.Category
	if err := tx.Order("parent_id asc").Find(&rows).Error; err != nil {
		return err
	}
	paths := make(map[string]string, len(rows))
	depths := make(map[string]int, len(rows))

	// Repeat until nothing changes: a child may be seen before its parent, and
	// the number of passes needed is at most the depth of the tree.
	for pass := 0; pass < 64; pass++ {
		progress := false
		for _, r := range rows {
			if _, done := paths[r.ID]; done {
				continue
			}
			if r.ParentID == nil || *r.ParentID == "" {
				paths[r.ID] = "/" + r.ID + "/"
				depths[r.ID] = 0
				progress = true
				continue
			}
			if parentPath, ok := paths[*r.ParentID]; ok {
				paths[r.ID] = parentPath + r.ID + "/"
				depths[r.ID] = depths[*r.ParentID] + 1
				progress = true
			}
		}
		if !progress {
			break
		}
	}

	for id, path := range paths {
		fields := map[string]any{"path": path, "depth": depths[id]}
		// Normalise "" to NULL while we are here, so nothing downstream has to
		// keep asking about both. A row migrated into a tree arrives with NULL
		// already; a row written before the column was nullable holds "", which
		// no foreign key constraint accepts.
		if depths[id] == 0 {
			fields["parent_id"] = nil
		}
		if err := tx.Model(&models.Category{}).Where("id = ?", id).Updates(fields).Error; err != nil {
			return err
		}
	}
	return nil
}
