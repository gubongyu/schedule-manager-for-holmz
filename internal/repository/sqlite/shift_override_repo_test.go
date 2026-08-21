package sqlite

import (
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
