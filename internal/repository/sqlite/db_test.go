package sqlite

import (
	"path/filepath"
	"testing"
)

func openTestDB(t *testing.T) *DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestOpenCreatesSchema(t *testing.T) {
	db := openTestDB(t)
	for _, table := range []string{"employees", "work_logs", "checklist_templates", "checklist_entries", "checklist_completions", "schedules", "playlist_items", "shifts", "shift_overrides", "app_settings", "rentals", "lost_items"} {
		var n int
		err := db.SQL.QueryRow("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&n)
		if err != nil || n != 1 {
			t.Errorf("table %s missing (n=%d, err=%v)", table, n, err)
		}
	}
}
