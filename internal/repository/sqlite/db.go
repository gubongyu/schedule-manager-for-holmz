// Package sqlite 는 domain Port들의 SQLite(modernc.org/sqlite, Pure Go) 구현을 제공한다.
package sqlite

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

type DB struct {
	SQL *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS employees (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	pin TEXT NOT NULL DEFAULT '',
	active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS work_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	employee_id INTEGER NOT NULL REFERENCES employees(id),
	date TEXT NOT NULL,
	clock_in TEXT NOT NULL,
	clock_out TEXT NOT NULL DEFAULT '',
	task_notes TEXT NOT NULL DEFAULT '',
	sync_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE TABLE IF NOT EXISTS checklist_templates (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	type TEXT NOT NULL CHECK (type IN ('open','close')),
	name TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	required INTEGER NOT NULL DEFAULT 0,
	active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS checklist_entries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	template_id INTEGER NOT NULL REFERENCES checklist_templates(id),
	type TEXT NOT NULL,
	name TEXT NOT NULL,
	required INTEGER NOT NULL DEFAULT 0,
	checked INTEGER NOT NULL DEFAULT 0,
	checked_at TEXT NOT NULL DEFAULT '',
	checked_by TEXT NOT NULL DEFAULT '',
	photo_path TEXT NOT NULL DEFAULT '',
	UNIQUE(date, template_id)
);
CREATE TABLE IF NOT EXISTS checklist_completions (
	date TEXT NOT NULL,
	type TEXT NOT NULL,
	completed_at TEXT NOT NULL,
	completed_by TEXT NOT NULL,
	PRIMARY KEY (date, type)
);
`

// Open 은 파일 경로의 SQLite DB를 열고 스키마를 적용한다.
func Open(path string) (*DB, error) {
	sqlDB, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// modernc.org/sqlite 는 동시 쓰기에 취약하므로 단일 커넥션으로 제한한다.
	sqlDB.SetMaxOpenConns(1)
	if _, err := sqlDB.Exec(schema); err != nil {
		sqlDB.Close()
		return nil, err
	}
	return &DB{SQL: sqlDB}, nil
}

func (d *DB) Close() error { return d.SQL.Close() }
