package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestShiftRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewShiftRepo(db)
	a := seedEmployee(t, db, "김서연")
	b := seedEmployee(t, db, "박준호")

	s1 := &domain.Shift{EmployeeID: a.ID, Weekday: "MON", Start: "09:00", End: "18:00"}
	s2 := &domain.Shift{EmployeeID: b.ID, Weekday: "MON", Start: "13:00", End: "22:00"}
	s3 := &domain.Shift{EmployeeID: a.ID, Weekday: "FRI", Start: "09:00", End: "15:00"}
	for _, s := range []*domain.Shift{s1, s2, s3} {
		if err := repo.Create(s); err != nil {
			t.Fatalf("Create: %v", err)
		}
		if s.ID == 0 {
			t.Fatal("Create did not set ID")
		}
	}

	list, err := repo.List()
	if err != nil || len(list) != 3 {
		t.Fatalf("List = %d (err=%v), want 3", len(list), err)
	}
	// 직원 이름이 조인되어 채워져야 한다
	for _, s := range list {
		if s.EmployeeName == "" {
			t.Errorf("EmployeeName empty: %+v", s)
		}
	}

	if err := repo.Delete(s2.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if list, _ = repo.List(); len(list) != 2 {
		t.Fatalf("List after delete = %d, want 2", len(list))
	}
}
