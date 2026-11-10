package vectors

import (
	"reflect"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

// The round trip is the whole contract: a value written and read back is the
// value written. Everything else in this package is in service of that.
func TestValueScanRoundTrip(t *testing.T) {
	cases := []Vector{
		nil,
		{},
		{0},
		{1, 2, 3},
		{-0.5, 0.25, 1e-7},
		// A float32 that is not exactly representable in decimal, which is
		// what an embedding is made of.
		{0.1, 0.2, 0.30000001},
	}

	for _, want := range cases {
		stored, err := want.Value()
		if err != nil {
			t.Fatalf("Value() on %v: %v", want, err)
		}
		var got Vector
		if err := got.Scan(stored); err != nil {
			t.Fatalf("Scan(%v): %v", stored, err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("round trip changed the value: wrote %v, read %v", want, got)
		}
	}
}

// And from the bytes a driver may hand back instead of a string.
func TestScanFromBytes(t *testing.T) {
	var v Vector
	if err := v.Scan([]byte("[1,2.5,-3]")); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if want := (Vector{1, 2.5, -3}); !reflect.DeepEqual(v, want) {
		t.Errorf("got %v, want %v", v, want)
	}
}

func TestScanRefusesNonsense(t *testing.T) {
	for _, bad := range []any{"1,2,3", "[1,two]", "{1,2}", 42} {
		var v Vector
		if err := v.Scan(bad); err == nil {
			t.Errorf("Scan(%#v) was accepted, and a silently empty embedding "+
				"makes every search return arbitrary rows", bad)
		}
	}
}

func TestDimensionOfReadsTheTag(t *testing.T) {
	cases := []struct {
		tag  string
		want int
	}{
		{`vector:"1536"`, 1536},
		{`vector:"768" json:"e"`, 768},
		{`json:"e"`, 0},
		{`vector:"0"`, 0},
		{`vector:"nope"`, 0},
	}
	for _, c := range cases {
		field := &schema.Field{Tag: reflect.StructTag(c.tag)}
		if got := DimensionOf(field); got != c.want {
			t.Errorf("DimensionOf(%s) = %d, want %d", c.tag, got, c.want)
		}
	}
	if got := DimensionOf(nil); got != 0 {
		t.Errorf("DimensionOf(nil) = %d, want 0", got)
	}
}

// A column name is interpolated into SQL, because an operand of an operator
// cannot be a bind parameter. So it is checked.
func TestDistanceRefusesAnInjectedColumn(t *testing.T) {
	for _, bad := range []string{
		"embedding; DROP TABLE documents",
		"embedding)",
		"Embedding",
		"",
		"1embedding",
	} {
		expr := CosineDistance(bad, Vector{1})
		if sql := exprSQL(expr); !isRefusal(sql) {
			t.Errorf("CosineDistance(%q) built %q, which runs", bad, sql)
		}
	}
	if sql := exprSQL(CosineDistance("embedding", Vector{1})); sql != "embedding <=> ?" {
		t.Errorf("a good column built %q", sql)
	}
	if sql := exprSQL(L2Distance("embedding", Vector{1})); sql != "embedding <-> ?" {
		t.Errorf("L2Distance built %q", sql)
	}
	if sql := exprSQL(InnerProduct("embedding", Vector{1})); sql != "embedding <#> ?" {
		t.Errorf("InnerProduct built %q", sql)
	}
}

type vectorModel struct {
	ID        string
	Embedding Vector
}

type plainModel struct {
	ID   string
	Name string
}

type embedsVector struct {
	vectorModel
	Extra string
}

func TestAnyUses(t *testing.T) {
	if !AnyUses(&vectorModel{}) {
		t.Error("a model with a Vector field was not detected, so the extension is never created")
	}
	if !AnyUses(&plainModel{}, &vectorModel{}) {
		t.Error("a Vector field in the second model was missed")
	}
	if !AnyUses(&embedsVector{}) {
		t.Error("a Vector reached through an embedded struct was missed")
	}
	if AnyUses(&plainModel{}) {
		t.Error("a model with no Vector was reported as using one, which would run " +
			"CREATE EXTENSION on a server that may not have pgvector")
	}
	if AnyUses() || AnyUses(nil) {
		t.Error("no models reported as using one")
	}
}

// exprSQL is the SQL a distance expression would contribute.
func exprSQL(e clause.Expression) string {
	expr, ok := e.(clause.Expr)
	if !ok {
		return ""
	}
	return expr.SQL
}

// isRefusal reports the expression distance() builds for a column it will not
// interpolate: one that cannot run, rather than one that orders by nothing.
func isRefusal(sql string) bool {
	return strings.Contains(sql, "grit_vectors_rejected_column_name")
}

// The ordering has to reach the query.
//
// This is the test that matters, and the one whose absence let a real bug look
// like a working feature. gorm's Order() switches on its argument's type and
// silently ignores an expression, so
//
//	db.Model(&M{}).Order(vectors.CosineDistance("embedding", q))
//
// built a query with no ORDER BY at all and returned rows in scan order, which
// for a few freshly inserted rows is insertion order and reads exactly like a
// working nearest-neighbour search. A test on the helper's own SQL string
// cannot see that. This one asks gorm what it would send.
func TestNearestReachesTheQuery(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("opening an in-memory database: %v", err)
	}

	q := Vector{1, 0, 0}
	cases := []struct {
		name     string
		clause   clause.OrderBy
		operator string
	}{
		{"Nearest", Nearest("embedding", q), "<=>"},
		{"NearestL2", NearestL2("embedding", q), "<->"},
		{"NearestByInnerProduct", NearestByInnerProduct("embedding", q), "<#>"},
	}

	for _, c := range cases {
		var out []vectorRow
		sql := db.Session(&gorm.Session{DryRun: true}).
			Model(&vectorRow{}).
			Clauses(c.clause).
			Limit(10).
			Find(&out).Statement.SQL.String()

		if !strings.Contains(strings.ToUpper(sql), "ORDER BY") {
			t.Errorf("%s produced a query with no ORDER BY, so it returns rows in scan "+
				"order and looks like it worked:\n  %s", c.name, sql)
			continue
		}
		if !strings.Contains(sql, "embedding "+c.operator) {
			t.Errorf("%s did not order by %s:\n  %s", c.name, c.operator, sql)
		}
	}
}

// And the refused column reaches the query as something that cannot run,
// rather than as nothing at all. (SELECT 1/0) was the first attempt and the
// planner dropped it, because an ORDER BY of a constant is a no-op.
func TestARefusedColumnCannotRun(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("opening an in-memory database: %v", err)
	}
	var out []vectorRow
	sql := db.Session(&gorm.Session{DryRun: true}).
		Model(&vectorRow{}).
		Clauses(Nearest("embedding; DROP TABLE documents", Vector{1})).
		Find(&out).Statement.SQL.String()

	if strings.Contains(sql, "DROP TABLE") {
		t.Fatalf("the column name was interpolated into the query:\n  %s", sql)
	}
	if !isRefusal(sql) {
		t.Errorf("a refused column produced a query that runs:\n  %s", sql)
	}
}

// vectorRow is a model for the statement-building tests above.
type vectorRow struct {
	ID        uint
	Embedding Vector `vector:"3"`
}
