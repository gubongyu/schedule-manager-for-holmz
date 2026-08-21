package service

import (
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

// 2026-08-21은 금요일. 해당 주는 8/17(월) ~ 8/23(일).
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
	svc := NewShiftService(sqlite.NewShiftRepo(db), sqlite.NewShiftOverrideRepo(db),
		fixedClock("2026-08-21T10:00:00+09:00"))
	return svc, emp
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

func TestRosterAppliesOverrides(t *testing.T) {
	svc, emp := setupShift(t)
	// 금요일(8/21) 기본 배치
	if _, err := svc.Add(emp.ID, "FRI", "09:00", "18:00"); err != nil {
		t.Fatal(err)
	}

	// 예외 없음 → 기본 배치 그대로
	r, err := svc.Roster("2026-08-21")
	if err != nil || len(r.Entries) != 1 || r.Weekday != "FRI" || r.Entries[0].Cover {
		t.Fatalf("base roster = %+v, err=%v", r, err)
	}

	// 휴가 등록 → 명단에서 제외 + Off 목록에 표시
	if _, err := svc.AddOverride(emp.ID, "2026-08-21", domain.OverrideOff, "", "", "여름 휴가"); err != nil {
		t.Fatalf("AddOverride off: %v", err)
	}
	r, _ = svc.Roster("2026-08-21")
	if len(r.Entries) != 0 || len(r.Off) != 1 || r.Off[0] != "김서연" {
		t.Errorf("roster with off = %+v", r)
	}

	// 대타 등록 → Cover 표시로 추가
	if _, err := svc.AddOverride(emp.ID, "2026-08-22", domain.OverrideWork, "10:00", "16:00", "대타"); err != nil {
		t.Fatalf("AddOverride work: %v", err)
	}
	r, _ = svc.Roster("2026-08-22") // 토요일: 기본 배치 없음
	if len(r.Entries) != 1 || !r.Entries[0].Cover || r.Entries[0].Start != "10:00" {
		t.Errorf("roster with cover = %+v", r)
	}
}

func TestAddOverrideValidation(t *testing.T) {
	svc, emp := setupShift(t)
	cases := []struct{ date, typ, start, end string }{
		{"2026/08/21", domain.OverrideOff, "", ""},   // 날짜 형식
		{"2026-08-21", "vacation", "", ""},           // 유형
		{"2026-08-21", domain.OverrideWork, "", ""},  // 대타는 시간 필수
		{"2026-08-21", domain.OverrideWork, "18:00", "09:00"}, // 시작>=종료
	}
	for _, c := range cases {
		if _, err := svc.AddOverride(emp.ID, c.date, c.typ, c.start, c.end, ""); err == nil {
			t.Errorf("AddOverride(%+v) should fail", c)
		}
	}
}

func TestWeekRosterCoversCurrentWeek(t *testing.T) {
	svc, emp := setupShift(t)
	if _, err := svc.Add(emp.ID, "MON", "09:00", "18:00"); err != nil {
		t.Fatal(err)
	}
	week, err := svc.WeekRoster()
	if err != nil || len(week) != 7 {
		t.Fatalf("WeekRoster = %d days (err=%v), want 7", len(week), err)
	}
	if week[0].Date != "2026-08-17" || week[0].Weekday != "MON" || week[6].Date != "2026-08-23" {
		t.Errorf("week range = %s..%s", week[0].Date, week[6].Date)
	}
	if len(week[0].Entries) != 1 {
		t.Errorf("MON entries = %+v", week[0].Entries)
	}
}

func TestWeekTotalsReflectOverrides(t *testing.T) {
	svc, emp := setupShift(t)
	must := func(_ *domain.Shift, err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(svc.Add(emp.ID, "MON", "09:00", "18:00")) // 9h
	must(svc.Add(emp.ID, "FRI", "09:00", "13:30")) // 4.5h

	totals, err := svc.WeekTotals()
	if err != nil || len(totals) != 1 || totals[0].Hours != 13.5 {
		t.Fatalf("totals = %+v, err=%v; want 13.5h", totals, err)
	}

	// 금요일(8/21) 휴가 → 9h만 남음
	if _, err := svc.AddOverride(emp.ID, "2026-08-21", domain.OverrideOff, "", "", ""); err != nil {
		t.Fatal(err)
	}
	// 토요일(8/22) 대타 2h 추가 → 11h
	if _, err := svc.AddOverride(emp.ID, "2026-08-22", domain.OverrideWork, "10:00", "12:00", ""); err != nil {
		t.Fatal(err)
	}
	totals, _ = svc.WeekTotals()
	if len(totals) != 1 || totals[0].Hours != 11 {
		t.Errorf("totals after overrides = %+v, want 11h", totals)
	}
}

func TestUpcomingOverridesAndRemove(t *testing.T) {
	svc, emp := setupShift(t)
	o, err := svc.AddOverride(emp.ID, "2026-08-25", domain.OverrideOff, "", "", "병원")
	if err != nil {
		t.Fatal(err)
	}
	// 과거 예외는 목록에서 제외
	if _, err := svc.AddOverride(emp.ID, "2026-08-01", domain.OverrideOff, "", "", ""); err != nil {
		t.Fatal(err)
	}
	list, err := svc.UpcomingOverrides()
	if err != nil || len(list) != 1 || list[0].Note != "병원" {
		t.Fatalf("UpcomingOverrides = %+v, err=%v", list, err)
	}
	if err := svc.RemoveOverride(o.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ = svc.UpcomingOverrides(); len(list) != 0 {
		t.Errorf("after remove = %+v", list)
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
