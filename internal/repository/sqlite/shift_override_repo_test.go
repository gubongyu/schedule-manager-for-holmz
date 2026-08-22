package sqlite

import (
	"database/sql"
	"path/filepath"
	"testing"

	"holmz/internal/domain"
)

func TestShiftOverrideRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewShiftOverrideRepo(db)
	emp := seedEmployee(t, db, "김서연")

	off := &domain.ShiftOverride{Date: "2026-08-24", EmployeeID: emp.ID, Type: domain.OverrideOff, Note: "휴가"}
	work := &domain.ShiftOverride{Date: "2026-08-25", EmployeeID: emp.ID, Type: domain.OverrideWork,
		Start: "10:00", End: "16:00", Note: "대타"}
	past := &domain.ShiftOverride{Date: "2026-08-01", EmployeeID: emp.ID, Type: domain.OverrideOff}
	for _, o := range []*domain.ShiftOverride{off, work, past} {
		if err := repo.Create(o); err != nil {
			t.Fatalf("Create: %v", err)
		}
		if o.ID == 0 {
			t.Fatal("Create did not set ID")
		}
	}

	list, err := repo.ListRange("2026-08-24", "2026-08-31")
	if err != nil || len(list) != 2 {
		t.Fatalf("ListRange = %d (err=%v), want 2 (past excluded)", len(list), err)
	}
	if list[0].Date != "2026-08-24" || list[0].EmployeeName != "김서연" || list[0].Type != "off" {
		t.Errorf("list[0] = %+v", list[0])
	}
	if list[1].Start != "10:00" || list[1].Note != "대타" {
		t.Errorf("list[1] = %+v", list[1])
	}

	if err := repo.Delete(off.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if list, _ = repo.ListRange("2026-08-01", "2026-08-31"); len(list) != 2 {
		t.Fatalf("after delete = %d, want 2", len(list))
	}
}

func TestShiftOverrideSubRoundTrip(t *testing.T) {
	db := openTestDB(t)
	repo := NewShiftOverrideRepo(db)
	a := seedEmployee(t, db, "김서연")
	b := seedEmployee(t, db, "박준호")

	sub := &domain.ShiftOverride{Date: "2026-08-26", EmployeeID: a.ID, Type: domain.OverrideSub,
		Start: "13:00", End: "15:00", CoverEmployeeID: b.ID, Note: "근무 변경"}
	if err := repo.Create(sub); err != nil {
		t.Fatalf("Create sub: %v", err)
	}
	list, err := repo.ListRange("2026-08-26", "2026-08-26")
	if err != nil || len(list) != 1 {
		t.Fatalf("ListRange = %+v, err=%v", list, err)
	}
	got := list[0]
	if got.Type != "sub" || got.CoverEmployeeID != b.ID || got.CoverName != "박준호" || got.EmployeeName != "김서연" {
		t.Errorf("sub roundtrip = %+v", got)
	}
}

// 구버전(CHECK에 'sub' 없음, cover 컬럼 없음) DB가 재생성 마이그레이션으로 갱신되어야 한다.
func TestOpenMigratesShiftOverrides(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")
	old, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`
		CREATE TABLE employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
			pin TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
		INSERT INTO employees (name) VALUES ('기존직원');
		CREATE TABLE shift_overrides (
			id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
			employee_id INTEGER NOT NULL REFERENCES employees(id),
			type TEXT NOT NULL CHECK (type IN ('off','work')),
			start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '',
			note TEXT NOT NULL DEFAULT '');
		INSERT INTO shift_overrides (date, employee_id, type, note) VALUES ('2026-08-20', 1, 'off', '기존 휴가')`); err != nil {
		t.Fatal(err)
	}
	old.Close()

	db, err := Open(path)
	if err != nil {
		t.Fatalf("Open old db: %v", err)
	}
	defer db.Close()
	repo := NewShiftOverrideRepo(db)

	// 기존 데이터 보존 확인
	list, err := repo.ListRange("2026-08-20", "2026-08-20")
	if err != nil || len(list) != 1 || list[0].Note != "기존 휴가" {
		t.Fatalf("migrated data = %+v, err=%v", list, err)
	}
	// 새 유형(sub) 저장 가능 확인
	if err := repo.Create(&domain.ShiftOverride{Date: "2026-08-21", EmployeeID: 1,
		Type: domain.OverrideSub, Start: "09:00", End: "12:00", CoverEmployeeID: 1}); err != nil {
		t.Fatalf("sub insert after migration: %v", err)
	}
}
