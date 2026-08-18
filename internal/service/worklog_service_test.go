package service

import (
	"path/filepath"
	"testing"
	"time"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func fixedClock(s string) func() time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return func() time.Time { return t }
}

func setupWorkLog(t *testing.T, clock func() time.Time) (*WorkLogService, *domain.Employee) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emp := &domain.Employee{Name: "김철수", Active: true}
	if err := sqlite.NewEmployeeRepo(db).Create(emp); err != nil {
		t.Fatal(err)
	}
	return NewWorkLogService(sqlite.NewWorkLogRepo(db), clock), emp
}

func TestClockInAndOut(t *testing.T) {
	svc, emp := setupWorkLog(t, fixedClock("2026-08-19T09:00:00+09:00"))

	w, err := svc.ClockIn(emp.ID)
	if err != nil {
		t.Fatalf("ClockIn: %v", err)
	}
	if w.Date != "2026-08-19" || w.ClockIn != "2026-08-19T09:00:00+09:00" || w.SyncStatus != "pending" {
		t.Errorf("ClockIn log = %+v", w)
	}

	if _, err := svc.ClockIn(emp.ID); err == nil {
		t.Error("second ClockIn should fail while shift open")
	}

	svc.clock = fixedClock("2026-08-19T18:00:00+09:00")
	out, err := svc.ClockOut(emp.ID)
	if err != nil {
		t.Fatalf("ClockOut: %v", err)
	}
	if out.ClockOut != "2026-08-19T18:00:00+09:00" || out.TotalHrs != 9 {
		t.Errorf("ClockOut log = %+v", out)
	}

	if _, err := svc.ClockOut(emp.ID); err == nil {
		t.Error("ClockOut with no open shift should fail")
	}
}

func TestAddNote(t *testing.T) {
	svc, emp := setupWorkLog(t, fixedClock("2026-08-19T09:00:00+09:00"))
	if _, err := svc.ClockIn(emp.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.AddNote(emp.ID, "원두 재고 정리"); err != nil {
		t.Fatalf("AddNote: %v", err)
	}
	if err := svc.AddNote(emp.ID, "머신 청소"); err != nil {
		t.Fatalf("AddNote 2: %v", err)
	}
	cur, err := svc.Current(emp.ID)
	if err != nil || cur == nil {
		t.Fatalf("Current: %+v, %v", cur, err)
	}
	want := "원두 재고 정리\n머신 청소"
	if cur.TaskNotes != want {
		t.Errorf("TaskNotes = %q, want %q", cur.TaskNotes, want)
	}
	if err := svc.AddNote(999, "no shift"); err == nil {
		t.Error("AddNote with no open shift should fail")
	}
}

func TestHistoryDelegates(t *testing.T) {
	svc, emp := setupWorkLog(t, fixedClock("2026-08-19T09:00:00+09:00"))
	if _, err := svc.ClockIn(emp.ID); err != nil {
		t.Fatal(err)
	}
	logs, err := svc.History("2026-08-19", "2026-08-19", 0)
	if err != nil || len(logs) != 1 {
		t.Fatalf("History = %d (err=%v), want 1", len(logs), err)
	}
}
