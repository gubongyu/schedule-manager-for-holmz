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
	student_id TEXT NOT NULL DEFAULT '',
	department TEXT NOT NULL DEFAULT '',
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
	repeat_count INTEGER NOT NULL DEFAULT 1,
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
	type TEXT NOT NULL CHECK (type IN ('off','work','sub')),
	start_time TEXT NOT NULL DEFAULT '',
	end_time TEXT NOT NULL DEFAULT '',
	cover_employee_id INTEGER NOT NULL DEFAULT 0,
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
	_, _ = sqlDB.Exec(`ALTER TABLE schedules ADD COLUMN repeat_count INTEGER NOT NULL DEFAULT 1`)
	_, _ = sqlDB.Exec(`ALTER TABLE employees ADD COLUMN student_id TEXT NOT NULL DEFAULT ''`)
	_, _ = sqlDB.Exec(`ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT ''`)
	migrateShiftOverrides(sqlDB)
	return &DB{SQL: sqlDB}, nil
}

// migrateShiftOverrides 는 구버전 shift_overrides 의 CHECK 제약이 'sub' 유형을 막는 경우
// 테이블을 재생성해 데이터를 보존한 채 제약과 cover_employee_id 컬럼을 갱신한다.
func migrateShiftOverrides(sqlDB *sql.DB) {
	if _, err := sqlDB.Exec(
		`INSERT INTO shift_overrides (date, employee_id, type) VALUES ('_probe_', 0, 'sub')`); err == nil {
		_, _ = sqlDB.Exec(`DELETE FROM shift_overrides WHERE date='_probe_'`)
		return
	}
	_, _ = sqlDB.Exec(`ALTER TABLE shift_overrides RENAME TO shift_overrides_old`)
	_, _ = sqlDB.Exec(`CREATE TABLE shift_overrides (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		date TEXT NOT NULL,
		employee_id INTEGER NOT NULL REFERENCES employees(id),
		type TEXT NOT NULL CHECK (type IN ('off','work','sub')),
		start_time TEXT NOT NULL DEFAULT '',
		end_time TEXT NOT NULL DEFAULT '',
		cover_employee_id INTEGER NOT NULL DEFAULT 0,
		note TEXT NOT NULL DEFAULT ''
	)`)
	_, _ = sqlDB.Exec(`INSERT INTO shift_overrides (id, date, employee_id, type, start_time, end_time, note)
		SELECT id, date, employee_id, type, start_time, end_time, note FROM shift_overrides_old`)
	_, _ = sqlDB.Exec(`DROP TABLE shift_overrides_old`)
	_, _ = sqlDB.Exec(`CREATE INDEX IF NOT EXISTS idx_shift_overrides_date ON shift_overrides(date)`)
}

func (d *DB) Close() error { return d.SQL.Close() }
