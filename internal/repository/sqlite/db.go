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
CREATE TABLE IF NOT EXISTS schedules (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	task_name TEXT NOT NULL,
	run_time TEXT NOT NULL,
	repeat_days TEXT NOT NULL DEFAULT '',
	action_type TEXT NOT NULL,
	payload TEXT NOT NULL DEFAULT '',
	active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS playlist_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	sort_order INTEGER NOT NULL DEFAULT 0,
	title TEXT NOT NULL DEFAULT '',
	video_url TEXT NOT NULL,
	video_id TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shifts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	employee_id INTEGER NOT NULL REFERENCES employees(id),
	weekday TEXT NOT NULL CHECK (weekday IN ('MON','TUE','WED','THU','FRI','SAT','SUN')),
	start_time TEXT NOT NULL,
	end_time TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shift_overrides (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	employee_id INTEGER NOT NULL REFERENCES employees(id),
	type TEXT NOT NULL CHECK (type IN ('off','work')),
	start_time TEXT NOT NULL DEFAULT '',
	end_time TEXT NOT NULL DEFAULT '',
	note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_shift_overrides_date ON shift_overrides(date);
CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL DEFAULT ''
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
	// 구버전 DB 마이그레이션: 이미 있는 컬럼이면 duplicate column 에러가 나므로 무시한다.
	_, _ = sqlDB.Exec(`ALTER TABLE schedules ADD COLUMN payload TEXT NOT NULL DEFAULT ''`)
	return &DB{SQL: sqlDB}, nil
}

func (d *DB) Close() error { return d.SQL.Close() }
