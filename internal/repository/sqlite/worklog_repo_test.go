package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func seedEmployee(t *testing.T, db *DB, name string) *domain.Employee {
	t.Helper()
	e := &domain.Employee{Name: name, Active: true}
	if err := NewEmployeeRepo(db).Create(e); err != nil {
		t.Fatalf("seed employee: %v", err)
	}
	return e
}

func TestWorkLogRepoOpenAndClose(t *testing.T) {
	db := openTestDB(t)
	repo := NewWorkLogRepo(db)
	emp := seedEmployee(t, db, "이영희")

	w := &domain.WorkLog{EmployeeID: emp.ID, Date: "2026-08-19", ClockIn: "2026-08-19T09:00:00+09:00", SyncStatus: "pending"}
	if err := repo.Create(w); err != nil {
		t.Fatalf("Create: %v", err)
	}

	open, err := repo.GetOpen(emp.ID)
	if err != nil || open == nil || open.ID != w.ID {
		t.Fatalf("GetOpen = %+v, err=%v", open, err)
	}
	if open.EmployeeName != "이영희" {
		t.Errorf("EmployeeName = %q, want 이영희", open.EmployeeName)
	}

	open.ClockOut = "2026-08-19T18:00:00+09:00"
	if err := repo.Update(open); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if again, _ := repo.GetOpen(emp.ID); again != nil {
		t.Errorf("GetOpen after close = %+v, want nil", again)
	}
}

func TestWorkLogRepoPendingSync(t *testing.T) {
	db := openTestDB(t)
	repo := NewWorkLogRepo(db)
	emp := seedEmployee(t, db, "A")

	closed := func(date string) *domain.WorkLog {
		return &domain.WorkLog{EmployeeID: emp.ID, Date: date, ClockIn: date + "T09:00:00+09:00",
			ClockOut: date + "T18:00:00+09:00", SyncStatus: "pending"}
	}
	w1, w2 := closed("2026-08-17"), closed("2026-08-18")
	working := &domain.WorkLog{EmployeeID: emp.ID, Date: "2026-08-19", ClockIn: "2026-08-19T09:00:00+09:00", SyncStatus: "pending"}
	for _, w := range []*domain.WorkLog{w1, w2, working} {
		if err := repo.Create(w); err != nil {
			t.Fatal(err)
		}
	}

	pending, err := repo.ListPending()
	if err != nil || len(pending) != 2 {
		t.Fatalf("ListPending = %d (err=%v), want 2 (working shift excluded)", len(pending), err)
	}

	if err := repo.MarkSynced([]int64{w1.ID, w2.ID}); err != nil {
		t.Fatalf("MarkSynced: %v", err)
	}
	pending, _ = repo.ListPending()
	if len(pending) != 0 {
		t.Fatalf("ListPending after MarkSynced = %d, want 0", len(pending))
	}
	logs, _ := repo.List("2026-08-17", "2026-08-17", 0)
	if logs[0].SyncStatus != "synced" {
		t.Errorf("SyncStatus = %q, want synced", logs[0].SyncStatus)
	}
}

func TestWorkLogRepoList(t *testing.T) {
	db := openTestDB(t)
	repo := NewWorkLogRepo(db)
	a := seedEmployee(t, db, "A")
	b := seedEmployee(t, db, "B")
	mk := func(emp int64, date string) {
		w := &domain.WorkLog{EmployeeID: emp, Date: date, ClockIn: date + "T09:00:00+09:00",
			ClockOut: date + "T18:00:00+09:00", SyncStatus: "pending"}
		if err := repo.Create(w); err != nil {
			t.Fatal(err)
		}
	}
	mk(a.ID, "2026-08-17")
	mk(a.ID, "2026-08-18")
	mk(b.ID, "2026-08-18")

	all, err := repo.List("2026-08-17", "2026-08-18", 0)
	if err != nil || len(all) != 3 {
		t.Fatalf("List all = %d (err=%v), want 3", len(all), err)
	}
	if all[0].TotalHrs != 9 {
		t.Errorf("TotalHrs = %v, want 9", all[0].TotalHrs)
	}
	onlyB, err := repo.List("2026-08-17", "2026-08-18", b.ID)
	if err != nil || len(onlyB) != 1 {
		t.Fatalf("List b = %d (err=%v), want 1", len(onlyB), err)
	}
	day17, err := repo.List("2026-08-17", "2026-08-17", 0)
	if err != nil || len(day17) != 1 {
		t.Fatalf("List day17 = %d (err=%v), want 1", len(day17), err)
	}
}
