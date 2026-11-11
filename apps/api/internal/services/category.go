package services

import (
	"context"
	// Grid rows arrive as maps and are decoded into the model here, through
	// the same JSON path a single create takes.
	"encoding/json"
	// checked reads the decode failure to name the field and the type it
	// wanted, rather than letting a wrong type reach the database as a 500.
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"store2/apps/api/internal/authz"
	"store2/apps/api/internal/concurrency"
	"store2/apps/api/internal/files"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/paginate"
	"store2/apps/api/internal/respond"
	"store2/apps/api/internal/storage"
)

// CategoryService owns every database read and write for categories.
//
// The handler reads the request, calls one of these and writes the answer. A
// job, a command or a test calls the same methods with no request at all, so a
// rule enforced here is enforced everywhere, not only on the HTTP route.
//
// Each method takes the context it runs in. It carries the organization the
// multitenant plugin resolved, the actor ownership is scoped by (see
// authz.WithActor, and authz.AsSystem for a job), and the cancellation that
// fires when a client goes away.
type CategoryService struct {
	DB *gorm.DB
	// Storage removes files a write replaced and claims the ones it keeps.
	Storage *storage.Storage
}

// categoryListConfig is what a client may search, sort and filter categories
// by. Whitelisted, because each name ends up in SQL.
var categoryListConfig = paginate.Config{
	Searchable: []string{"name", "slug"},
	Sortable:   map[string]bool{"id": true, "created_at": true, "name": true, "slug": true},
	Filterable: map[string]bool{"id": true, "name": true, "slug": true, "image": true, "featured": true, "parent_id": true},
}

// expandCategoryEmbedded rewrites the columns a map update cannot carry.
//
// Nothing to do: Category has no embedded column. It exists so that every
// path writing through a map calls the same thing, and adding a money field
// later is a change here rather than at each of them.
func expandCategoryEmbedded(updates map[string]interface{}) {}

// writableCategory is every column Patch and Bulk may write. id, the
// timestamps and the version are the framework's, and are dropped.
var writableCategory = map[string]bool{
	"name":      true,
	"image":     true,
	"featured":  true,
	"parent_id": true,
}

// db binds the database to ctx, so whatever a middleware put there reaches
// GORM's callbacks: the multitenant plugin scopes by it.
func (s *CategoryService) db(ctx context.Context) *gorm.DB {
	return s.DB.WithContext(ctx)
}

// List returns one page of categories.
//
//	archived "true" or "1"   only archived rows
//	archived "all"           both
//	anything else            only live rows
func (s *CategoryService) List(ctx context.Context, p paginate.Params, archived string) (paginate.Result[models.Category], error) {
	query := s.db(ctx).Model(&models.Category{}).Preload("Parent")

	// Archived rows are excluded by default. Anything else means an operator
	// archives twelve rows, sees the count go down, and finds them again the
	// next time somebody sorts by a different column.
	switch archived {
	case "true", "1":
		query = query.Where("archived_at IS NOT NULL")
	case "all":
		// no filter
	default:
		query = query.Where("archived_at IS NULL")
	}

	return paginate.List[models.Category](query, p, categoryListConfig)
}

// Export hands every matching category to each, a batch at a time, so a large
// table is never in memory at once.
//
// search goes through the same clause builder List uses, so the rows an export
// contains are the rows the screen showed. It used to be a second copy of that
// builder, which is how the two came to disagree about escaping a wildcard.
//
// No ORDER BY of its own: FindInBatches pages by primary key, which is
// creation order for the time-ordered ids Grit issues, and a sort in front of
// that key repeated rows from the second batch on.
func (s *CategoryService) Export(ctx context.Context, search string, each func(rows []models.Category) error) error {
	query := s.db(ctx).Model(&models.Category{}).Preload("Parent")
	if search != "" {
		// The clause List uses, not a copy of it. This was a copy, and the
		// copy had already drifted: neither escaped LIKE wildcards, so a
		// search for "50%" matched every row, and fixing one would have left
		// the other (review 2.19).
		if clause, args := paginate.BuildSearchClause(categoryListConfig.Searchable, search); clause != "" {
			query = query.Where(clause, args...)
		}
	}

	// FindInBatches fills rows and pages by primary key. The tx it hands the
	// callback is a fresh session with no query on it, so each batch is read
	// from rows: re-reading it through tx.Scan found nothing, and every export
	// was an empty file with a 200.
	var rows []models.Category
	return query.FindInBatches(&rows, 1000, func(tx *gorm.DB, batch int) error {
		return each(rows)
	}).Error
}

// GetByID returns one category with the relations shown beside it.
func (s *CategoryService) GetByID(ctx context.Context, id string) (*models.Category, error) {
	var item models.Category
	if err := s.db(ctx).Preload("Parent").First(&item, "id = ?", id).Error; err != nil {
		return nil, err
	}
	if d := authz.Inspect(ctx, "categories.read", &item); !d.Allowed() {
		return nil, authz.Denied("categories.read", d)
	}
	return &item, nil
}

// load reads the row a write is about to change, without its relations.
//
// ability is what the caller is about to do, "update" or "delete", so a
// policy can refuse one without refusing the other.
func (s *CategoryService) load(ctx context.Context, id, ability string) (*models.Category, error) {
	var item models.Category
	if err := s.db(ctx).First(&item, "id = ?", id).Error; err != nil {
		return nil, err
	}
	// A policy rule narrows this further than the route's permission did.
	// None defined means no narrowing, which is how the project behaved
	// before it had policies. See internal/policies.
	if d := authz.Inspect(ctx, "categories."+ability, &item); !d.Allowed() {
		return nil, authz.Denied("categories."+ability, d)
	}
	return &item, nil
}

// checked applies a whitelisted patch onto a copy of the row and runs the
// model's own rules over the result.
//
// The whitelist answers "may this column be written at all". It does not
// answer "is this a legal value", and before v3.450.0 nothing did on this
// path: binding:"required" fired on Create and Update and nowhere else, so
// {"seats":"x"} reached the database as a type error and came back a 500
// rather than a 422 naming the field. See review 2.4.
//
// Onto a COPY of the current row, not onto an empty struct, so a rule about a
// field the patch does not mention still sees the value already stored. The
// copy is thrown away; the write still goes through Updates with the map, so
// a column the caller did not send is not overwritten with a zero.
//
// Before expandCategoryEmbedded, deliberately: that rewrites a money field
// into its two columns, and those names are not json tags, so a decode after
// it would silently drop them.
func (s *CategoryService) checked(current *models.Category, updates map[string]interface{}) error {
	raw, err := json.Marshal(updates)
	if err != nil {
		return respond.Rule("could not read the fields to write")
	}
	patched := *current
	if err := json.Unmarshal(raw, &patched); err != nil {
		var typeErr *json.UnmarshalTypeError
		if errors.As(err, &typeErr) && typeErr.Field != "" {
			return respond.Rule("%s must be %s", typeErr.Field, s.readableType(typeErr.Type.String()))
		}
		return respond.Rule("one of the fields is the wrong type")
	}
	return respond.ValidateStruct(&patched)
}

// readableType turns a Go type into something worth showing a person.
//
// A method rather than a function, because the generator writes one of these
// per resource: a package-level helper of the same name twice over is a
// project with two generated resources that does not compile.
func (s *CategoryService) readableType(t string) string {
	switch {
	case strings.HasPrefix(t, "int"), strings.HasPrefix(t, "uint"):
		return "a whole number"
	case strings.HasPrefix(t, "float"):
		return "a number"
	case t == "bool":
		return "true or false"
	case t == "string":
		return "text"
	case strings.HasPrefix(t, "time."):
		return "a date"
	default:
		return "of type " + t
	}
}

// permitted keeps only the rows a policy allows this caller to act on.
//
// The single-row paths go through s.load, which runs authz.Inspect. The bulk
// paths loaded with Find and wrote, so a rule in internal/policies was
// evadable by selecting the rows and using a bulk action: the route's
// permission was the only check (review 2.4).
//
// Denied rows are reported rather than silently skipped. A bulk action that
// says it changed twelve rows and changed nine is worse than one that refuses
// and says which.
func (s *CategoryService) permitted(ctx context.Context, rows []models.Category, ability string) ([]models.Category, []string) {
	allowed := make([]models.Category, 0, len(rows))
	var denied []string
	for i := range rows {
		if d := authz.Inspect(ctx, "categories."+ability, &rows[i]); !d.Allowed() {
			denied = append(denied, rows[i].ID)
			continue
		}
		allowed = append(allowed, rows[i])
	}
	return allowed, denied
}

// conflict is the answer to a write whose precondition failed: the version
// the row is at now.
func (s *CategoryService) conflict(ctx context.Context, id string) error {
	var current models.Category
	if err := s.db(ctx).Select("version").First(&current, "id = ?", id).Error; err != nil {
		return err
	}
	return &concurrency.ErrConflict{Current: current.Version}
}

// Create saves a new category and fills item in as it was stored.
func (s *CategoryService) Create(ctx context.Context, item *models.Category) error {
	db := s.db(ctx)
	if err := db.Create(item).Error; err != nil {
		return err
	}
	if err := db.Preload("Parent").First(item, "id = ?", item.ID).Error; err != nil {
		return err
	}
	if s.Storage != nil {
		files.ClaimRefs(ctx, db, item)
	}
	return nil
}

// Update writes updates to one category. With a precondition it lands only
// if the row is still at that version, and otherwise returns an
// *concurrency.ErrConflict naming the version it is at.
func (s *CategoryService) Update(ctx context.Context, id string, updates map[string]interface{}, pre *concurrency.Precondition) (*models.Category, error) {
	item, err := s.load(ctx, id, "update")
	if err != nil {
		return nil, err
	}
	db := s.db(ctx)
	expandCategoryEmbedded(updates)
	oldItem := *item // the files before the write, to find the ones it replaced
	written := db.Model(item).Scopes(pre.Scope).Updates(updates)
	if err := written.Error; err != nil {
		return nil, err
	}
	// pre named a version this record has moved past: someone else saved
	// first. A conflict rather than overwriting their change.
	if pre.Missed(written) {
		return nil, s.conflict(ctx, item.ID)
	}
	if err := db.Preload("Parent").First(item, "id = ?", item.ID).Error; err != nil {
		return nil, err
	}
	if s.Storage != nil {
		files.CleanupRemoved(ctx, s.Storage, &oldItem, item)
		files.ClaimRefs(ctx, db, item)
	}
	return item, nil
}

// Patch writes only the columns body names, leaving every other one as it
// is. Keys that are not writable columns are dropped. It returns the row and
// the columns it wrote.
func (s *CategoryService) Patch(ctx context.Context, id string, body map[string]interface{}, pre *concurrency.Precondition) (*models.Category, map[string]interface{}, error) {
	item, err := s.load(ctx, id, "update")
	if err != nil {
		return nil, nil, err
	}
	db := s.db(ctx)

	updates := map[string]interface{}{}
	for k, v := range body {
		if writableCategory[k] {
			updates[k] = v
		}
	}
	touchedRelations := false
	if len(updates) == 0 && !touchedRelations {
		return nil, nil, respond.Rule("No writable fields in request body")
	}

	// The model's own rules, before anything is written. See checked.
	if err := s.checked(item, updates); err != nil {
		return nil, nil, err
	}

	expandCategoryEmbedded(updates)
	if len(updates) > 0 {
		written := db.Model(item).Scopes(pre.Scope).Updates(updates)
		if err := written.Error; err != nil {
			return nil, nil, err
		}
		if pre.Missed(written) {
			return nil, nil, s.conflict(ctx, item.ID)
		}
	}
	if err := db.Preload("Parent").First(item, "id = ?", item.ID).Error; err != nil {
		return nil, nil, err
	}
	return item, updates, nil
}

// Delete soft-deletes one category and returns it as it was.
func (s *CategoryService) Delete(ctx context.Context, id string) (*models.Category, error) {
	item, err := s.load(ctx, id, "delete")
	if err != nil {
		return nil, err
	}
	if err := s.db(ctx).Delete(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

// CategoryBulkResult is what a bulk action did.
type CategoryBulkResult struct {
	// IDs are the rows acted on: those requested that exist, that the caller
	// may touch, and that the action applies to.
	IDs []string
	// Updates are the columns a patch wrote, after the whitelist.
	Updates map[string]interface{}
}

// Bulk applies one action to many categories in a single transaction: all of
// it lands or none of it does. action is delete, archive, restore or patch.
func (s *CategoryService) Bulk(ctx context.Context, action string, ids []string, patch map[string]interface{}) (CategoryBulkResult, error) {
	db := s.db(ctx)
	var result CategoryBulkResult

	// Unarchived rows for archive, archived for restore: without it a mixed
	// selection reports "12 archived" having changed three.
	scope := db.Model(&models.Category{}).Where("id IN ?", ids)
	if action == "restore" {
		scope = scope.Where("archived_at IS NOT NULL")
	} else if action == "archive" {
		scope = scope.Where("archived_at IS NULL")
	}
	var items []models.Category
	if err := scope.Find(&items).Error; err != nil {
		return result, fmt.Errorf("loading categories: %w", err)
	}
	// A policy rule narrows this further than the route's permission did.
	// Without it, any rule in internal/policies was evadable by selecting the
	// rows and using a bulk action (review 2.4).
	//
	// The ability is the one the action performs, so a policy that allows
	// archiving and refuses deleting is honoured by both.
	ability := "update"
	switch action {
	case "delete":
		ability = "delete"
	case "archive", "restore":
		ability = "update"
	}
	items, denied := s.permitted(ctx, items, ability)
	if len(denied) > 0 {
		// Refused whole rather than partly applied. A bulk action that
		// reports twelve and changed nine is worse than one that says no.
		//
		// As a denial, not a rule violation: this is 403, the same answer the
		// single-row path gives, and a client that branches on the status
		// should not see one code for one row and another for twelve.
		return CategoryBulkResult{}, authz.Denied("categories."+ability, authz.Deny(fmt.Sprintf(
			"not allowed to %s %d of the selected categories", action, len(denied))))
	}

	for _, item := range items {
		result.IDs = append(result.IDs, item.ID)
	}
	if len(result.IDs) == 0 {
		return result, nil
	}

	if action == "patch" {
		// The same whitelist as Patch. Framework-owned columns are dropped
		// rather than refused, so a client sending the whole row is not wrong.
		result.Updates = map[string]interface{}{}
		for k, v := range patch {
			if writableCategory[k] {
				result.Updates[k] = v
			}
		}
		if len(result.Updates) == 0 {
			return CategoryBulkResult{}, respond.Rule("No writable fields in patch")
		}
		// And the model's own rules, against each row as it will be. One
		// patch over many rows can still be invalid for some of them: a
		// conditional field's requirement depends on the row it lands on.
		for i := range items {
			if err := s.checked(&items[i], result.Updates); err != nil {
				return CategoryBulkResult{}, err
			}
		}
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		switch action {
		case "delete":
			return tx.Where("id IN ?", result.IDs).Delete(&models.Category{}).Error
		case "archive":
			return tx.Model(&models.Category{}).Where("id IN ?", result.IDs).
				Update("archived_at", time.Now()).Error
		case "restore":
			return tx.Model(&models.Category{}).Where("id IN ?", result.IDs).
				Update("archived_at", nil).Error
		case "patch":
			expandCategoryEmbedded(result.Updates)
			return tx.Model(&models.Category{}).Where("id IN ?", result.IDs).
				Updates(result.Updates).Error
		}
		return respond.Rule("unknown bulk action %q", action)
	})
	if err != nil {
		return CategoryBulkResult{}, err
	}
	return result, nil
}

// CategoryRowError is one row of a grid that could not be saved, and why.
//
// The index is the row's position in the request, not its id: a create has no
// id yet, and the grid needs to put the message back on the line the operator
// is looking at.
type CategoryRowError struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
}

// CategoryGridEdit is one row's changes: the id, and only the columns that
// changed. Sending the whole row would make every save a write to every column,
// which loses a concurrent edit to a column this operator never touched.
type CategoryGridEdit struct {
	ID    string                 `json:"id"`
	Patch map[string]interface{} `json:"patch"`
	// Version is what this row was at when the grid loaded it, the same
	// precondition If-Match carries on a single-row save.
	//
	// In the body rather than in a header, because one header cannot hold
	// forty versions and each row in a grid has its own. Nil means no
	// precondition for that row, so a client that sends none behaves as it
	// always did (grit#182).
	Version *int `json:"version"`
}

// BulkEdit writes a different patch to each row, in one transaction.
//
// Bulk(action: "patch") writes ONE set of values to every selected row, which
// is the right shape for "set the status of these forty" and the wrong one for
// a spreadsheet, where the point is that each row differs. Hence two methods
// rather than one with a mode.
//
// All of it lands or none of it does. A grid where rows 1 to 9 saved and row 10
// did not is one the operator has to reconcile by hand against a list of
// indexes, and they will not.
func (s *CategoryService) BulkEdit(ctx context.Context, edits []CategoryGridEdit) ([]string, []CategoryRowError, error) {
	var rowErrors []CategoryRowError
	type write struct {
		id      string
		updates map[string]interface{}
		version *int
	}
	writes := make([]write, 0, len(edits))

	for i, edit := range edits {
		if edit.ID == "" {
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: "no id"})
			continue
		}
		// The same whitelist Patch uses. Framework-owned columns are dropped
		// rather than refused, so a grid sending a whole row is not wrong.
		updates := map[string]interface{}{}
		for k, v := range edit.Patch {
			if writableCategory[k] {
				updates[k] = v
			}
		}
		if len(updates) == 0 {
			// Nothing writable changed. Not an error: a grid sends every row
			// the operator touched, and touching a cell and putting it back is
			// a thing people do.
			continue
		}
		// Not expanded yet: s.checked below decodes these keys as json tags,
		// and a money field's two columns are not that.
		writes = append(writes, write{id: edit.ID, updates: updates, version: edit.Version})
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors, nil
	}
	if len(writes) == 0 {
		return nil, nil, nil
	}

	// Only rows this caller may touch. An owned resource scopes to the caller,
	// so a guessed id in the grid changes nothing rather than somebody else's
	// row.
	ids := make([]string, 0, len(writes))
	for _, w := range writes {
		ids = append(ids, w.id)
	}
	var allowed []models.Category
	if err := s.db(ctx).Model(&models.Category{}).Where("id IN ?", ids).Find(&allowed).Error; err != nil {
		return nil, nil, fmt.Errorf("loading categories to edit: %w", err)
	}
	// A policy rule narrows this further than the route's permission did.
	// Without it, a rule in internal/policies was evadable by selecting the
	// rows in the grid and editing them here: Patch consults the policy
	// through s.load and this path did not (review 2.4).
	permittedRows, denied := s.permitted(ctx, allowed, "update")
	allowed = permittedRows

	exists := make(map[string]bool, len(allowed))
	for _, row := range allowed {
		exists[row.ID] = true
	}
	deniedSet := make(map[string]bool, len(denied))
	for _, id := range denied {
		deniedSet[id] = true
	}
	for i, w := range writes {
		switch {
		case deniedSet[w.id]:
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: "not allowed to edit this category"})
		case !exists[w.id]:
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: "no such category"})
		}
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors, nil
	}

	current := make(map[string]*models.Category, len(allowed))
	for i := range allowed {
		current[allowed[i].ID] = &allowed[i]
	}

	// A row somebody else has saved since the grid loaded it.
	//
	// Checked before the writes and reported by index, so the operator is told
	// which line is stale rather than having the whole save refused with one
	// banner. The statement below is ALSO scoped by the version: this check
	// closes the common case with a readable message, and the WHERE closes the
	// gap between this read and that write.
	for i, w := range writes {
		if w.version == nil {
			continue
		}
		row, ok := current[w.id]
		if !ok {
			continue
		}
		if row.Version != *w.version {
			rowErrors = append(rowErrors, CategoryRowError{
				Index: i,
				// fmt rather than strconv: the service imports fmt already, and
				// a new import in a generated file is a block to rebuild
				// rather than a line to add.
				Message: fmt.Sprintf("somebody else saved this row since you loaded it (it is at version %d)", row.Version),
			})
		}
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors, nil
	}

	// And the model's own rules, per row, against the row as it will be.
	// Reported by index so a grid can put the message on the cell.
	for i, w := range writes {
		row, ok := current[w.id]
		if !ok {
			continue
		}
		if err := s.checked(row, w.updates); err != nil {
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: err.Error()})
		}
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors, nil
	}

	// Expanded after validation: a money field becomes two columns whose
	// names are not json tags, so a decode after this drops them.
	for i := range writes {
		expandCategoryEmbedded(writes[i].updates)
	}

	saved := make([]string, 0, len(writes))
	err := s.db(ctx).Transaction(func(tx *gorm.DB) error {
		for _, w := range writes {
			// Row by row, because each has its own values. One statement per
			// row inside one transaction: the round trips are the cost of the
			// feature, and the atomicity is the point of it.
			q := tx.Model(&models.Category{}).Where("id = ?", w.id)
			if w.version != nil {
				q = q.Where("version = ?", *w.version)
			}
			res := q.Updates(w.updates)
			if res.Error != nil {
				return res.Error
			}
			// Nothing written where a version was asserted: the row moved
			// between the check above and this statement. The whole grid rolls
			// back, because half a spreadsheet saved is worse than none.
			if w.version != nil && res.RowsAffected == 0 {
				return &concurrency.ErrConflict{Current: *w.version}
			}
			saved = append(saved, w.id)
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return saved, nil, nil
}

// BulkCreate inserts many categories in one transaction.
//
// Every row is decoded before anything is written, so a spreadsheet with a
// mistake on row 7 is refused whole and reported against row 7, rather than
// creating six rows and stopping.
func (s *CategoryService) BulkCreate(ctx context.Context, rows []map[string]interface{}) ([]models.Category, []CategoryRowError, error) {
	var rowErrors []CategoryRowError
	items := make([]models.Category, 0, len(rows))

	for i, row := range rows {
		// Through the same JSON path a single create takes, so the model's own
		// tags and hooks apply identically. A second way into the table is a
		// second set of rules to keep in step.
		encoded, err := json.Marshal(row)
		if err != nil {
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: "could not be read"})
			continue
		}
		var item models.Category
		if err := json.Unmarshal(encoded, &item); err != nil {
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: err.Error()})
			continue
		}
		// Never from the request: these are the database's to set.
		item.ID = ""
		item.CreatedAt = time.Time{}
		item.UpdatedAt = time.Time{}
		// The binding: tags, which encoding/json does not know about.
		//
		// A single create is bound by gin, so required and min are enforced
		// before the handler runs. This path decodes the row itself, and
		// without this line the grid could insert a row the form would then
		// refuse to save: a category with no category went in, and editing it
		// answered "Category is required" with no way to get at the row.
		if err := respond.ValidateStruct(&item); err != nil {
			rowErrors = append(rowErrors, CategoryRowError{Index: i, Message: err.Error()})
			continue
		}
		items = append(items, item)
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors, nil
	}
	if len(items) == 0 {
		return nil, nil, nil
	}

	err := s.db(ctx).Transaction(func(tx *gorm.DB) error {
		// One at a time rather than CreateInBatches, because the model's
		// BeforeCreate hooks (the uuid, the slug, a sequence number) have to
		// run per row, and a batch insert of rows whose slugs collide is a
		// constraint violation with no row number in it.
		for i := range items {
			if err := tx.Create(&items[i]).Error; err != nil {
				return fmt.Errorf("row %d: %w", i+1, err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return items, nil, nil
}

// publicScope narrows a query to what an anonymous caller may see.
//
// Every public read below goes through it. Add a condition here and it applies
// to the list, the detail page and everything derived from them at once.
func (s *CategoryService) publicScope(q *gorm.DB) *gorm.DB {
	q = q.Where("archived_at IS NULL")
	return q
}

// ListPublic returns one page of what the public surface may list: rows that are
// not archived. cfg is the allowlist the public handler keeps.
func (s *CategoryService) ListPublic(ctx context.Context, params paginate.Params, cfg paginate.Config) (paginate.Result[models.Category], error) {
	query := s.publicScope(s.db(ctx).Model(&models.Category{}))
	return paginate.List[models.Category](query, params, cfg)
}

// GetPublic returns the category whose slug is key, if it is
// not archived.
//
// A row outside that is a 404 rather than a 403: whether it exists is itself
// not public.
func (s *CategoryService) GetPublic(ctx context.Context, key string) (*models.Category, error) {
	var item models.Category
	if err := s.publicScope(s.db(ctx).Model(&models.Category{})).
		Where("slug = ?", key).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// PublicSubtreeIDs returns the ids of the live rows at or under path: a node
// and everything below it, in one indexed LIKE on the materialized path.
func (s *CategoryService) PublicSubtreeIDs(ctx context.Context, path string) ([]string, error) {
	var ids []string
	err := s.publicScope(s.db(ctx).Model(&models.Category{})).
		Where("path LIKE ?", path+"%").
		Pluck("id", &ids).Error
	return ids, err
}

// PublicTreeRows returns every live row, parents before their children and
// siblings in the order the admin arranged, for the public tree to assemble.
func (s *CategoryService) PublicTreeRows(ctx context.Context) ([]models.Category, error) {
	var rows []models.Category
	err := s.publicScope(s.db(ctx).Model(&models.Category{})).
		Order("depth asc, position asc, name asc").
		Find(&rows).Error
	return rows, err
}

// RelatedPublic returns up to limit live categories sharing item's
// parent, newest first, item excluded. A row with no parent has no
// siblings, so it gets the newest rows instead: a worse recommendation than a
// real match, and a better one than an empty strip.
func (s *CategoryService) RelatedPublic(ctx context.Context, item *models.Category, limit int) ([]models.Category, error) {
	query := s.publicScope(s.db(ctx).Model(&models.Category{})).
		Where("id <> ?", item.ID)
	if item.ParentID != nil && *item.ParentID != "" {
		query = query.Where("parent_id = ?", *item.ParentID)
	}
	var rows []models.Category
	err := query.Order("created_at desc").Limit(limit).Find(&rows).Error
	return rows, err
}
