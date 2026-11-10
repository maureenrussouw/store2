package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/gorm"

	"store2/apps/api/internal/config"
	"store2/apps/api/internal/crypto"
	"store2/apps/api/internal/database"
	"store2/apps/api/internal/migrate"
	"store2/apps/api/internal/models"
	"store2/apps/api/internal/paginate"
	"store2/apps/api/internal/sync"
	"store2/apps/api/internal/vectors"
	"store2/apps/api/migrations"
)

func main() {
	fresh := flag.Bool("fresh", false, "Drop all tables before migrating")
	status := flag.Bool("status", false, "Show what each recorded run changed")
	down := flag.Bool("down", false, "Undo what the most recent run added")
	sqlDown := flag.Bool("sql-down", false, "Run the down half of the most recent checked-in SQL migrations")
	steps := flag.Int("steps", 1, "How many runs --down or --sql-down undoes")
	dryRun := flag.Bool("dry-run", false, "With --down, print the statements and change nothing")
	yes := flag.Bool("yes", false, "With --down, do not ask before dropping")
	gritVersion := flag.String("grit-version", "", "Recorded against the run")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// The history has to exist before anything reads or writes it, including on a
	// project that was scaffolded before down migrations existed. Its first run
	// there is recorded as a baseline, because the schema it finds was built by
	// runs nobody recorded and dropping all of it is not a rollback.
	if err := migrate.EnsureHistory(db); err != nil {
		log.Fatalf("%v", err)
	}
	// The checked-in pairs are recorded separately, because they are a
	// different mechanism: see internal/migrate/sql.go.
	if err := migrate.EnsureSQLHistory(db); err != nil {
		log.Fatalf("%v", err)
	}

	switch {
	case *status:
		if err := showStatus(db); err != nil {
			log.Fatalf("%v", err)
		}
		if err := showSQLStatus(db); err != nil {
			log.Fatalf("%v", err)
		}
		return
	case *down:
		if err := rollback(db, *steps, *dryRun, *yes); err != nil {
			log.Fatalf("%v", err)
		}
		return
	case *sqlDown:
		if err := rollbackSQL(db, *steps, *dryRun, *yes); err != nil {
			log.Fatalf("%v", err)
		}
		return
	}

	if *fresh {
		// The most destructive thing this command does, and the only one that
		// used to do it without asking: grit migrate down has a confirmation
		// and --fresh did not.
		if !*yes {
			fmt.Print("--fresh drops every table in the database, and nothing brings the rows back. ")
			if !confirmed() {
				fmt.Println("Nothing was dropped.")
				return
			}
		}
		fmt.Println("Dropping all tables...")
		if err := database.DropAll(db); err != nil {
			log.Fatalf("Failed to drop tables: %v", err)
		}
		// Both histories described a schema that no longer exists. The SQL one
		// is read again a few lines below, and DropAll has just taken its
		// table: without this that read fails and every checked-in pair is
		// skipped by this run.
		if err := migrate.Reset(db); err != nil {
			log.Fatalf("%v", err)
		}
		if err := migrate.ResetSQL(db); err != nil {
			log.Fatalf("%v", err)
		}
		fmt.Println("All tables dropped.")
	}

	before, err := migrate.Snapshot(db)
	if err != nil {
		log.Fatalf("Failed to read the current schema: %v", err)
	}

	// Empty webhook external ids become NULL before the unique index is built.
	//
	// The unique index on (provider, external_id) used to be declared in a
	// method nothing called, so a project from before that was fixed can hold
	// several rows with external_id = "", and no database will build a unique
	// index over repeated empty strings. NULL repeats freely, and an event the
	// provider gave no id was never deduplicable anyway.
	//
	// Here rather than inside models.Migrate because this file is rewritten by
	// grit upgrade and models/user.go is not: that one holds the model registry
	// people add to. A migration fix living in a file upgrades never touch is a
	// fix only new projects get.
	if db.Migrator().HasTable("webhook_events") {
		if err := db.Exec("UPDATE webhook_events SET external_id = NULL WHERE external_id = ''").Error; err != nil {
			log.Printf("migrate: clearing empty webhook external ids (the unique index may refuse them): %v", err)
		}
	}

	// pgvector, if and only if some model has an embedding column. AutoMigrate
	// creates that column and cannot run CREATE EXTENSION, and the SQL pairs
	// further down run after it, so this is the only place the ordering works.
	// A no-op on every other database and on every project with no vector
	// field (grit#191).
	if err := vectors.EnsureExtension(db, models.Models()...); err != nil {
		log.Fatalf("%v", err)
	}

	fmt.Println("Running migrations...")
	if err := models.Migrate(db); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	// Postgres gets a trigram index on every column tagged search:"trigram", the
	// ones list search reads.
	if err := paginate.EnsureSearchIndexes(db, models.Models()...); err != nil {
		log.Printf("Search indexes were not created, so search reads the whole table: %v", err)
	}
	// Rows soft-deleted before a delete also moved updated_at get it now, so
	// sync pull, which pages on updated_at, carries those deletes too.
	if err := sync.BackfillUpdatedAt(db, models.Models()...); err != nil {
		log.Printf("Some soft-deleted rows were not brought up to date for sync: %v", err)
	}
	// Values in encrypted columns written before FIELD_ENCRYPTION_KEY was set,
	// two-factor secrets among them, are encrypted now. Without a key this
	// changes nothing.
	if n, err := crypto.EncryptExisting(db, models.Models()...); err != nil {
		log.Printf("Some values in encrypted columns are still stored in the clear: %v", err)
	} else if n > 0 {
		fmt.Printf("Encrypted %d value(s) stored before field encryption was on.\n", n)
	}

	after, err := migrate.Snapshot(db)
	if err != nil {
		// The migration itself worked. Only the record of it did not, and
		// reporting failure here would read as a failed migration.
		fmt.Printf("Migrations completed, but the schema could not be read back, so this run was not recorded: %v\n", err)
		os.Exit(0)
	}

	changes := migrate.Diff(before, after)

	// The checked-in pairs, after AutoMigrate and before either exit below.
	// They run even when AutoMigrate found nothing to do, which is the common
	// case for a pair that only renames or backfills.
	if err := applySQL(db); err != nil {
		log.Fatalf("%v", err)
	}

	if len(changes) == 0 {
		fmt.Println("Migrations completed successfully. The schema was already up to date.")
		os.Exit(0)
	}

	// A baseline is the run that found an empty database, whether that is a new
	// project or an old one meeting the history for the first time.
	baseline := len(before) == 0
	run, err := migrate.Record(db, changes, *gritVersion, baseline)
	if err != nil {
		fmt.Printf("Migrations completed, but recording the run failed, so it cannot be rolled back: %v\n", err)
		os.Exit(0)
	}

	fmt.Printf("Migrations completed successfully. Run %s added %d change(s):\n", run.ID, len(changes))
	for _, change := range changes {
		fmt.Println("  + " + change.String())
	}
	if baseline {
		fmt.Println("\nThis is the baseline run, the one that built the schema. It cannot be rolled back: use grit migrate --fresh to start over.")
	} else {
		fmt.Println("\nUndo it with: grit migrate down")
	}
	os.Exit(0)
}

// applySQL runs the pending checked-in pairs, in version order.
func applySQL(db *gorm.DB) error {
	all, err := migrate.LoadSQLMigrations(migrations.FS)
	if err != nil {
		return err
	}
	if len(all) == 0 {
		return nil
	}

	// An applied migration whose file has since been edited is a database and a
	// file that disagree. Reported rather than fatal: the fix is a new pair, and
	// refusing to migrate would block writing one.
	if changed, err := migrate.ChangedSQL(db, all); err == nil && len(changed) > 0 {
		for _, id := range changed {
			fmt.Printf("WARNING: migrations/%s has been edited since it ran. The database has the old version and this file has the new one. Write a new migration instead.\n", id)
		}
	}

	pending, err := migrate.PendingSQL(db, all)
	if err != nil {
		return err
	}
	if len(pending) == 0 {
		return nil
	}
	fmt.Printf("Applying %d SQL migration(s)...\n", len(pending))
	applied, err := migrate.ApplySQL(db, all)
	for _, id := range applied {
		fmt.Println("  + " + id)
	}
	return err
}

// showSQLStatus lists the checked-in pairs and whether each one has run.
func showSQLStatus(db *gorm.DB) error {
	all, err := migrate.LoadSQLMigrations(migrations.FS)
	if err != nil {
		return err
	}
	if len(all) == 0 {
		return nil
	}
	applied, err := migrate.AppliedSQL(db)
	if err != nil {
		return err
	}
	when := map[string]string{}
	sums := map[string]string{}
	for _, row := range applied {
		when[row.ID] = row.AppliedAt.Format("2006-01-02 15:04")
		sums[row.ID] = row.Checksum
	}

	fmt.Println("\nSQL migrations (migrations/):")
	for _, m := range all {
		state := "pending"
		if at, ok := when[m.ID()]; ok {
			state = "applied " + at
			if sums[m.ID()] != m.Checksum {
				state += ", EDITED SINCE"
			}
		}
		fmt.Printf("  %s  [%s]\n", m.ID(), state)
	}
	return nil
}

// rollbackSQL runs the down half of the most recent pairs.
//
// It prints the statements first and asks, for the same reason the computed
// rollback does: a down file can drop a column, and nothing brings the data
// back.
func rollbackSQL(db *gorm.DB, steps int, dryRun, yes bool) error {
	if steps < 1 {
		steps = 1
	}
	all, err := migrate.LoadSQLMigrations(migrations.FS)
	if err != nil {
		return err
	}
	applied, err := migrate.AppliedSQL(db)
	if err != nil {
		return err
	}
	if len(applied) == 0 {
		fmt.Println("No SQL migrations have been applied.")
		return nil
	}
	byID := map[string]migrate.SQLMigration{}
	for _, m := range all {
		byID[m.ID()] = m
	}

	var plan []migrate.SQLMigration
	for i := len(applied) - 1; i >= 0 && len(plan) < steps; i-- {
		m, ok := byID[applied[i].ID]
		if !ok {
			return fmt.Errorf("%s was applied but its files are not in this build, so there is nothing to run; check out the commit that added it and try again", applied[i].ID)
		}
		plan = append(plan, m)
	}

	fmt.Printf("This will run %d down migration(s), newest first:\n\n", len(plan))
	for _, m := range plan {
		fmt.Println("  migrations/" + m.ID() + ".down.sql")
		for _, statement := range migrate.SplitSQL(m.Down) {
			fmt.Println("      " + statement + ";")
		}
	}
	if dryRun {
		fmt.Println("\n--dry-run: nothing was run.")
		return nil
	}
	if !yes {
		fmt.Print("\nA down migration can drop data, and nothing brings it back. Type yes to continue: ")
		answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
		if strings.TrimSpace(strings.ToLower(answer)) != "yes" {
			fmt.Println("Nothing was run.")
			return nil
		}
	}

	undone, err := migrate.RollbackSQL(db, all, steps)
	for _, id := range undone {
		fmt.Println("  - " + id)
	}
	if err != nil {
		return err
	}
	fmt.Printf("\nRolled back %d SQL migration(s).\n", len(undone))
	return nil
}

// showStatus prints the recorded runs, newest first, with what each one added.
func showStatus(db *gorm.DB) error {
	runs, err := migrate.History(db, 20)
	if err != nil {
		return err
	}
	if len(runs) == 0 {
		fmt.Println("No migration runs recorded yet. Run grit migrate.")
		return nil
	}
	for _, run := range runs {
		changes, err := migrate.ChangesOf(db, run.ID)
		if err != nil {
			return err
		}
		state := "applied"
		if run.Baseline {
			state = "baseline, cannot be rolled back"
		}
		if run.RolledBackAt != nil {
			state = "rolled back " + run.RolledBackAt.Format("2006-01-02 15:04")
		}
		version := run.GritVersion
		if version == "" {
			version = "unknown"
		}
		fmt.Printf("%s  %s  grit %s  %d change(s)  [%s]\n",
			run.ID, run.AppliedAt.Format("2006-01-02 15:04"), version, len(changes), state)
		for _, change := range changes {
			fmt.Println("    " + change.String())
		}
	}
	return nil
}

// rollback undoes the most recent runs that have not been undone already.
//
// It prints every statement before running any of them, and stops at the
// baseline rather than dropping the schema out from under the application.
func rollback(db *gorm.DB, steps int, dryRun, yes bool) error {
	if steps < 1 {
		steps = 1
	}
	runs, err := migrate.Undone(db, steps)
	if err != nil {
		return err
	}
	if len(runs) == 0 {
		fmt.Println("Nothing to roll back: every recorded run has already been undone.")
		return nil
	}

	type plan struct {
		run        migrate.Run
		changes    []migrate.Change
		statements []string
	}
	var plans []plan
	for _, run := range runs {
		if run.Baseline {
			if len(plans) == 0 {
				return fmt.Errorf("run %s is the baseline, the run that built this schema: "+
					"rolling it back would drop the database. Use grit migrate --fresh to start over", run.ID)
			}
			fmt.Printf("Stopping at run %s, the baseline that built the schema.\n", run.ID)
			break
		}
		changes, err := migrate.ChangesOf(db, run.ID)
		if err != nil {
			return err
		}
		plans = append(plans, plan{run: run, changes: changes, statements: migrate.Statements(db, changes)})
	}

	fmt.Printf("Rolling back %d run(s):\n", len(plans))
	for _, item := range plans {
		fmt.Printf("\n  %s (%s, %d change(s))\n",
			item.run.ID, item.run.AppliedAt.Format("2006-01-02 15:04"), len(item.changes))
		for _, statement := range item.statements {
			fmt.Println("    " + statement + ";")
		}
	}
	if dryRun {
		fmt.Println("\n--dry-run: nothing was changed.")
		return nil
	}

	fmt.Println("\nDropping a table or a column does not keep the data in it. This is not reversible.")
	if !yes && !confirmed() {
		fmt.Println("Cancelled. Nothing was changed.")
		return nil
	}

	for _, item := range plans {
		applied, err := migrate.Rollback(db, item.run, item.changes, false)
		for _, statement := range applied {
			fmt.Println("  - " + statement)
		}
		if err != nil {
			return fmt.Errorf("rolling back %s: %w", item.run.ID, err)
		}
		fmt.Printf("Run %s rolled back.\n", item.run.ID)
	}
	return nil
}

// confirmed asks before dropping. Anything other than yes cancels, and so does a
// closed stdin, which is what a CI job or a pipe looks like: there --yes is the
// way to mean it.
func confirmed() bool {
	fmt.Print("Type yes to continue: ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && strings.TrimSpace(line) == "" {
		fmt.Println()
		return false
	}
	return strings.TrimSpace(strings.ToLower(line)) == "yes"
}
