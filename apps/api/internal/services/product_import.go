package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"store2/apps/api/internal/authz"
	"store2/apps/api/internal/imports"
	"store2/apps/api/internal/models"
)

// StartImport records a CSV import of products about to run: the job a client
// polls for progress.
func (s *ProductService) StartImport(ctx context.Context, total int) (*models.ImportJob, error) {
	// CreatedBy is who may follow the job: GET /imports/:id answers only them,
	// or an admin.
	job := models.ImportJob{Resource: "products", Status: "processing", Total: total, CreatedBy: authz.UserIDFrom(ctx)}
	if err := s.db(ctx).Create(&job).Error; err != nil {
		return nil, fmt.Errorf("starting the products import: %w", err)
	}
	return &job, nil
}

// ImportCSV streams the CSV at path, creating products in batches and
// updating the ImportJob jobID as it goes. belongs_to columns are resolved by
// their natural key (or id); unique-conflict rows are skipped; per-row failures
// are recorded. The file is removed when done.
//
// It outlives the request that started it, so give it a context that is not
// cancelled with the response. context.WithoutCancel of the request's keeps the
// caller, whom an owned resource's rows belong to, and the organization the
// multitenant plugin stamps them with.
func (s *ProductService) ImportCSV(ctx context.Context, jobID, path string) {
	db := s.db(ctx)
	// record writes the job's state for the client polling it. A failure is
	// logged rather than dropped: the import carries on, and a job stuck on
	// its last state is at least explained.
	record := func(fields map[string]interface{}) {
		if err := db.Model(&models.ImportJob{}).Where("id = ?", jobID).Updates(fields).Error; err != nil {
			log.Printf("import job %s: recording progress: %v", jobID, err)
		}
	}
	defer os.Remove(path)
	// This runs in a bare goroutine, so gin.Recovery() does NOT cover it: an
	// unrecovered panic here would crash the whole server. Recover, and mark
	// the job failed so the client's poll terminates instead of hanging.
	defer func() {
		if r := recover(); r != nil {
			record(map[string]interface{}{
				"status":  "failed",
				"message": fmt.Sprintf("import crashed: %v", r),
			})
		}
	}()

	// Imports take turns: each holds a database connection and writes in
	// batches for its whole run, and a burst of them drained the pool every
	// request shares. See internal/imports.
	release := imports.Wait(func() {
		record(map[string]interface{}{"message": "Waiting for another import to finish"})
	})
	defer release()

	f, err := os.Open(path)
	if err != nil {
		record(map[string]interface{}{
			"status": "failed", "message": "could not reopen upload",
		})
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1

	headers, err := reader.Read()
	if err != nil {
		record(map[string]interface{}{
			"status": "failed", "message": "empty or invalid CSV",
		})
		return
	}
	idx := map[string]int{}
	for i, name := range headers {
		idx[strings.TrimSpace(strings.ToLower(name))] = i
	}
	get := func(rec []string, key string) (string, bool) {
		if i, ok := idx[key]; ok && i < len(rec) {
			return strings.TrimSpace(rec[i]), true
		}
		return "", false
	}

	// categoryIDs remembers the Category each name in the CSV resolved to, so a
	// distinct name costs one lookup rather than one per row. A missing Category
	// is created; any other error fails the row instead of passing for missing.
	categoryIDs := map[string]string{}
	resolveCategory := func(v string) (string, error) {
		if id, ok := categoryIDs[v]; ok {
			return id, nil
		}
		var rel models.Category
		err := db.Where("name = ?", v).First(&rel).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			rel = models.Category{Name: v}
			if err = db.Create(&rel).Error; err != nil {
				// Another import may have created it in the meantime.
				if again := db.Where("name = ?", v).First(&rel).Error; again == nil {
					err = nil
				}
			}
		}
		if err != nil {
			return "", fmt.Errorf("category %q: %w", v, err)
		}
		categoryIDs[v] = rel.ID
		return rel.ID, nil
	}

	// parentIDs remembers the Product each name in the CSV resolved to, so a
	// distinct name costs one lookup rather than one per row.
	//
	// A missing Product is NOT created here, because Product requires category_id
	// and a parent column holds only the name. Creating it from the name
	// alone fails on the constraint, once per row, which is what grit#129 was.
	// The row is refused instead, with something a person can act on.
	parentIDs := map[string]string{}
	resolveParent := func(v string) (string, error) {
		if id, ok := parentIDs[v]; ok {
			return id, nil
		}
		var rel models.Product
		if err := db.Where("name = ?", v).First(&rel).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", fmt.Errorf("parent %q does not exist. An import cannot create one, because Product requires category_id, which this file has no column for. Add the Product first, or import parent records before this one", v)
			}
			return "", fmt.Errorf("parent %q: %w", v, err)
		}
		parentIDs[v] = rel.ID
		return rel.ID, nil
	}

	created, skipped, failed := 0, 0, 0
	rowErrors := []map[string]interface{}{}

	// checkpoint writes current progress so the client's poll sees movement.
	checkpoint := func(status, message string) {
		errsJSON, _ := json.Marshal(rowErrors)
		record(map[string]interface{}{
			"status":    status,
			"processed": created + skipped + failed,
			"created":   created,
			"skipped":   skipped,
			"failed":    failed,
			"errors":    string(errsJSON),
			"message":   message,
		})
	}

	const batchSize = 200
	type pendingRow struct {
		item   models.Product
		rowNum int
	}
	batch := make([]pendingRow, 0, batchSize)

	// flush inserts the accumulated batch. CreateInBatches (with OnConflict
	// DoNothing) amortises the per-row fsync that makes large SQLite imports
	// crawl. If the whole batch errors (a bad row can poison it), we fall back
	// to per-row inserts so created/skipped/failed stay accurate and only the
	// offending row is dropped.
	flush := func() {
		if len(batch) == 0 {
			return
		}
		items := make([]models.Product, len(batch))
		for i := range batch {
			items[i] = batch[i].item
		}
		res := db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(items, len(items))
		if res.Error == nil {
			created += int(res.RowsAffected)
			skipped += len(items) - int(res.RowsAffected)
		} else {
			for i := range batch {
				one := batch[i].item
				r := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&one)
				switch {
				case r.Error != nil:
					failed++
					if len(rowErrors) < 50 {
						rowErrors = append(rowErrors, map[string]interface{}{"row": batch[i].rowNum, "message": r.Error.Error()})
					}
				case r.RowsAffected == 0:
					skipped++
				default:
					created++
				}
			}
		}
		batch = batch[:0]
	}

	rowNum := 1 // header was row 1
	for {
		rec, err := reader.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			failed++
			if len(rowErrors) < 50 {
				rowErrors = append(rowErrors, map[string]interface{}{"row": rowNum, "message": err.Error()})
			}
			continue
		}

		item := models.Product{}
		if v, ok := get(rec, "name"); ok {
			item.Name = v
		}
		if v, ok := get(rec, "price"); ok {
			n, _ := strconv.Atoi(v)
			item.Price = n
		}
		if v, ok := get(rec, "description"); ok {
			item.Description = v
		}
		if v, ok := get(rec, "category"); ok && v != "" {
			id, err := resolveCategory(v)
			if err != nil {
				failed++
				if len(rowErrors) < 50 {
					rowErrors = append(rowErrors, map[string]interface{}{"row": rowNum, "message": err.Error()})
				}
				continue
			}
			item.CategoryID = id
		}
		if v, ok := get(rec, "parent"); ok && v != "" {
			id, err := resolveParent(v)
			if err != nil {
				failed++
				if len(rowErrors) < 50 {
					rowErrors = append(rowErrors, map[string]interface{}{"row": rowNum, "message": err.Error()})
				}
				continue
			}
			item.ParentID = &id
		}
		batch = append(batch, pendingRow{item: item, rowNum: rowNum})

		if len(batch) >= batchSize {
			flush()
			checkpoint("processing", "")
		}
	}
	flush()

	checkpoint("completed", fmt.Sprintf("Imported %d, skipped %d, failed %d", created, skipped, failed))
}
