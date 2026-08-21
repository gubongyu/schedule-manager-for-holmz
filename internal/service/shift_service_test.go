package service

import (
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupShift(t *testing.T) (*ShiftService, *domain.Employee) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emp := &domain.Employee{Name: "김서연", Active: true}
	if err := sqlite.NewEmployeeRepo(db).Create(emp); err != nil {
		t.Fatal(err)
	}
	return NewShiftService(sqlite.NewShiftRepo(db)), emp
}

func TestShiftAddValidation(t *testing.T) {
	svc, emp := setupShift(t)

	if _, err := svc.Add(emp.ID, "MON", "09:00", "18:00"); err != nil {
		t.Fatalf("valid Add: %v", err)
	}
	cases := []struct{ weekday, start, end string }{
		{"XXX", "09:00", "18:00"}, // 잘못된 요일
		{"MON", "9:00", "18:00"},  // 시간 형식
		{"MON", "09:00", "밤"},     // 시간 형식
		{"MON", "18:00", "09:00"}, // 시작 >= 종료
		{"MON", "09:00", "09:00"}, // 시작 == 종료
	}
	for _, c := range cases {
		if _, err := svc.Add(emp.ID, c.weekday, c.start, c.end); err == nil {
			t.Errorf("Add(%q,%q,%q) should fail", c.weekday, c.start, c.end)
		}
	}
}

func TestShiftWeekViewOrderedAndGrouped(t *testing.T) {
	svc, emp := setupShift(t)
	must := func(_ *domain.Shift, err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(svc.Add(emp.ID, "FRI", "09:00", "15:00"))
	must(svc.Add(emp.ID, "MON", "13:00", "22:00"))
	must(svc.Add(emp.ID, "MON", "09:00", "18:00"))

	week, err := svc.Week()
	if err != nil {
		t.Fatalf("Week: %v", err)
	}
	if len(week) != 7 || week[0].Weekday != "MON" || week[6].Weekday != "SUN" {
		t.Fatalf("Week must return 7 days MON..SUN: %+v", week)
	}
	mon := week[0]
	if len(mon.Shifts) != 2 || mon.Shifts[0].Start != "09:00" || mon.Shifts[1].Start != "13:00" {
		t.Errorf("MON shifts should be sorted by start: %+v", mon.Shifts)
	}
	if len(week[4].Shifts) != 1 { // FRI
		t.Errorf("FRI shifts = %+v", week[4].Shifts)
	}
	if len(week[6].Shifts) != 0 { // SUN 빈 요일도 포함
		t.Errorf("SUN should be empty: %+v", week[6].Shifts)
	}
}

func TestShiftRemove(t *testing.T) {
	svc, emp := setupShift(t)
	s, err := svc.Add(emp.ID, "TUE", "10:00", "14:00")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Remove(s.ID); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	week, _ := svc.Week()
	if len(week[1].Shifts) != 0 {
		t.Errorf("TUE after remove = %+v", week[1].Shifts)
	}
}
