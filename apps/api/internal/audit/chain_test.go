package audit

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"store2/apps/api/internal/models"
)

func openChain(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&models.ActivityLog{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func write(t *testing.T, db *gorm.DB, n int) {
	t.Helper()
	batch := make([]models.ActivityLog, n)
	for i := range batch {
		batch[i] = models.ActivityLog{UserID: "u1", Method: "POST", Path: "/api/v1/notes", Status: 201}
	}
	if err := appendBatch(db, batch); err != nil {
		t.Fatalf("append: %v", err)
	}
}

// Postgres keeps microseconds and MySQL milliseconds, and the hash covers
// created_at. Before v3.215.0 the stamp carried nanoseconds, the database
// rounded them away, and the chain failed verification on its first row.
func TestStampSurvivesTheDatabasesPrecision(t *testing.T) {
	prev := time.Time{}
	for i := 0; i < 50; i++ {
		s := nextStamp(prev)
		if !s.Equal(s.Round(time.Millisecond)) {
			t.Fatalf("stamp %v has precision a database would round away", s)
		}
		if !prev.IsZero() && !s.After(prev) {
			t.Fatalf("stamp %v is not after %v, so verify order would differ from write order", s, prev)
		}
		prev = s
	}
}

func TestChainVerifies(t *testing.T) {
	db := openChain(t)
	write(t, db, 40)
	if err := AppendChained(db, &models.ActivityLog{UserID: "u2", Method: "SECURITY", Path: "security.login.failed"}); err != nil {
		t.Fatalf("append chained: %v", err)
	}
	write(t, db, 10)
	status, err := VerifyChain(context.Background(), db)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !status.Valid || status.TotalEntries != 51 {
		t.Fatalf("chain did not verify: %+v", status)
	}
}

// Keying the chain is what makes it mean anything (review 2.7).
//
// Unkeyed, the hash is SHA-256 over inputs anybody can read off this source.
// Somebody with database write access edits a row, recomputes the chain from
// there, and verification passes: the one thing the chain exists to detect.
// This is that attack, and it has to fail.
func TestAKeyedChainRefusesARecomputedRow(t *testing.T) {
	SetChainKey([]byte("a-server-held-key"))
	defer SetChainKey(nil)

	db := openChain(t)
	write(t, db, 5)

	if status, err := VerifyChain(context.Background(), db); err != nil || !status.Valid {
		t.Fatalf("a freshly written keyed chain does not verify: %+v %v", status, err)
	}

	// The attacker's move, in full. Editing one row is caught by the next
	// link whether the chain is keyed or not, so that is not the attack: the
	// attack is to edit a row and then rewrite every row after it so the
	// links join up again. With an unkeyed chain that works completely,
	// because the hash is computable by anybody who can read the source.
	var rows []models.ActivityLog
	if err := db.Order("created_at, id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	rows[2].Path = "/api/v1/not-what-happened"

	prev := rows[2].PrevHash
	for i := 2; i < len(rows); i++ {
		canonical, err := Canonical(&rows[i])
		if err != nil {
			t.Fatal(err)
		}
		forged, ok := computeUnder(AlgoSHA256, prev, canonical)
		if !ok {
			t.Fatal("the unkeyed algorithm is not computable, so this test proves nothing")
		}
		if err := db.Model(&models.ActivityLog{}).Where("id = ?", rows[i].ID).
			Updates(map[string]interface{}{
				"path":      rows[i].Path,
				"prev_hash": prev,
				"hash":      forged,
				"hash_algo": AlgoSHA256,
			}).Error; err != nil {
			t.Fatal(err)
		}
		prev = forged
	}

	status, err := VerifyChain(context.Background(), db)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if status.Valid {
		t.Error("a chain rewritten without the key verified, so the key buys nothing: " +
			"anybody with database access can edit a row and re-link what follows it")
	}
	// Reported at the first rewritten row, not somewhere downstream, so
	// everything before it is still known good.
	if status.BrokenAtID != rows[2].ID {
		t.Errorf("the break is reported at %s, want the first rewritten row %s",
			status.BrokenAtID, rows[2].ID)
	}
}

// A project that upgraded has rows from before the chain was keyed, and they
// still have to verify: a chain that reports every historical row as tampered
// is a chain nobody will look at again.
func TestTheChainVerifiesAcrossTheDayItWasKeyed(t *testing.T) {
	// Written unkeyed, as an older release wrote them.
	SetChainKey(nil)
	db := openChain(t)
	write(t, db, 4)

	// And then the key arrives, mid-chain, as it does on upgrade.
	SetChainKey([]byte("a-server-held-key"))
	defer SetChainKey(nil)
	write(t, db, 4)

	status, err := VerifyChain(context.Background(), db)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if !status.Valid || status.TotalEntries != 8 {
		t.Fatalf("a chain keyed part way through does not verify: %+v", status)
	}
}

// And the rule that stops the obvious way around the key: rewrite everything
// in the algorithm you can compute. A chain does not go back to being
// unkeyed, so an unkeyed row after a keyed one is tampering whatever its hash
// says.
func TestTheChainRefusesADowngradeAfterAKeyedRow(t *testing.T) {
	SetChainKey(nil)
	db := openChain(t)
	write(t, db, 2)

	SetChainKey([]byte("a-server-held-key"))
	defer SetChainKey(nil)
	write(t, db, 2)

	// Take the last row back to the unkeyed algorithm, correctly hashed under
	// it. Without the ordering rule this verifies.
	var rows []models.ActivityLog
	if err := db.Order("created_at, id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	last := rows[len(rows)-1]
	canonical, err := Canonical(&last)
	if err != nil {
		t.Fatal(err)
	}
	downgraded, _ := computeUnder(AlgoSHA256, last.PrevHash, canonical)
	if err := db.Model(&models.ActivityLog{}).Where("id = ?", last.ID).
		Updates(map[string]interface{}{"hash": downgraded, "hash_algo": AlgoSHA256}).Error; err != nil {
		t.Fatal(err)
	}

	status, err := VerifyChain(context.Background(), db)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if status.Valid {
		t.Error("a row downgraded to the unkeyed algorithm verified, so the key can be stepped around")
	}
	if !strings.Contains(status.Message, "does not go back to being unkeyed") {
		t.Errorf("the failure does not explain itself: %q", status.Message)
	}
}

// A changed row is found, a reseal has to name it, and the reseal leaves its
// own record in the chain.
func TestResealNamesTheBreakAndRecordsItself(t *testing.T) {
	db := openChain(t)
	write(t, db, 5)
	var third models.ActivityLog
	db.Order("created_at asc, id asc").Offset(2).First(&third)
	db.Exec("UPDATE activity_logs SET status = 500 WHERE id = ?", third.ID)

	status, _ := VerifyChain(context.Background(), db)
	if status.Valid || status.BrokenAtID != third.ID {
		t.Fatalf("the changed row was not found: %+v", status)
	}
	if _, err := Reseal(context.Background(), db, "not-the-break", "admin", "127.0.0.1", "test"); err == nil {
		t.Fatal("a reseal that did not name the first bad entry was accepted")
	}
	n, err := Reseal(context.Background(), db, third.ID, "admin", "127.0.0.1", "test")
	if err != nil {
		t.Fatalf("reseal: %v", err)
	}
	if n != 3 {
		t.Errorf("resealed %d entries, want the 3 from the break onward", n)
	}
	status, _ = VerifyChain(context.Background(), db)
	if !status.Valid {
		t.Fatalf("still broken after the reseal: %+v", status)
	}
	var last models.ActivityLog
	db.Order("created_at desc, id desc").First(&last)
	if last.Method != "SECURITY" || !strings.HasPrefix(last.Path, "audit.chain.resealed") || last.UserID != "admin" {
		t.Errorf("the reseal did not record itself: %+v", last)
	}
	if _, err := Reseal(context.Background(), db, third.ID, "admin", "", ""); err == nil {
		t.Error("a reseal of a chain that verifies was accepted")
	}
}
