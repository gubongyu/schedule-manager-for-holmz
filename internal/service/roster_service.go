package service

import (
	"fmt"
	"math"
	"sort"
	"time"

	"holmz/internal/domain"
)

// RosterService 는 저장된 배치와 예외를 조합해 "실제 누가 언제 근무하는가"를 해석한다.
// 편집(ShiftService)과 분리해, 조회·집계 로직이 저장 규칙과 얽히지 않게 한다.
type RosterService struct {
	repo      domain.ShiftRepo
	overrides domain.ShiftOverrideRepo
	clock     func() time.Time
}

func NewRosterService(repo domain.ShiftRepo, overrides domain.ShiftOverrideRepo, clock func() time.Time) *RosterService {
	if clock == nil {
		clock = time.Now
	}
	return &RosterService{repo: repo, overrides: overrides, clock: clock}
}

// RosterEntry 는 특정 날짜의 확정 근무 1건이다. Cover 는 대타/추가 근무 여부다.
type RosterEntry struct {
	EmployeeID   int64  `json:"employeeId"`
	EmployeeName string `json:"employeeName"`
	Start        string `json:"start"`
	End          string `json:"end"`
	Cover        bool   `json:"cover"`
}

// DayRoster 는 특정 날짜의 예외(휴가·대타)가 반영된 실제 근무 명단이다.
type DayRoster struct {
	Date    string        `json:"date"` // YYYY-MM-DD
	Weekday string        `json:"weekday"`
	Entries []RosterEntry `json:"entries"`
	Off     []string      `json:"off"` // 휴가자 이름
}

// EmployeeHours 는 직원별 주간 배치 시간 합계다.
type EmployeeHours struct {
	EmployeeID int64   `json:"employeeId"`
	Name       string  `json:"name"`
	Hours      float64 `json:"hours"`
}

var goWeekdayToCode = map[time.Weekday]string{
	time.Monday: "MON", time.Tuesday: "TUE", time.Wednesday: "WED", time.Thursday: "THU",
	time.Friday: "FRI", time.Saturday: "SAT", time.Sunday: "SUN",
}

// subtractInterval 은 배치 e 에서 [subStart, subEnd) 구간을 뺀 나머지 조각(0~2개)을 반환한다.
func subtractInterval(e RosterEntry, subStart, subEnd string) []RosterEntry {
	if subEnd <= e.Start || subStart >= e.End {
		return []RosterEntry{e} // 겹치지 않음
	}
	var out []RosterEntry
	if e.Start < subStart {
		left := e
		left.End = subStart
		out = append(out, left)
	}
	if subEnd < e.End {
		right := e
		right.Start = subEnd
		out = append(out, right)
	}
	return out
}

func hoursBetween(start, end string) float64 {
	toMin := func(t string) int {
		var h, m int
		fmt.Sscanf(t, "%d:%d", &h, &m)
		return h*60 + m
	}
	return math.Round(float64(toMin(end)-toMin(start))/60*100) / 100
}

// Roster 는 해당 날짜의 실제 근무 명단을 반환한다: 요일 기본 배치 − 휴가자 + 대타.
func (s *RosterService) Roster(date string) (*DayRoster, error) {
	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("잘못된 날짜입니다: %s", date)
	}
	weekday := goWeekdayToCode[d.Weekday()]

	all, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	ovs, err := s.overrides.ListRange(date, date)
	if err != nil {
		return nil, err
	}

	offIDs := map[int64]bool{}
	roster := &DayRoster{Date: date, Weekday: weekday, Entries: []RosterEntry{}, Off: []string{}}
	for _, o := range ovs {
		if o.Type == domain.OverrideOff {
			offIDs[o.EmployeeID] = true
			roster.Off = append(roster.Off, o.EmployeeName)
		}
	}
	for _, sh := range all {
		if sh.Weekday == weekday && !offIDs[sh.EmployeeID] {
			roster.Entries = append(roster.Entries, RosterEntry{
				EmployeeID: sh.EmployeeID, EmployeeName: sh.EmployeeName, Start: sh.Start, End: sh.End})
		}
	}
	// 대타(sub): 원래 직원의 배치에서 해당 시간 구간을 빼고, 대체 직원을 그 구간에 넣는다.
	for _, o := range ovs {
		if o.Type != domain.OverrideSub {
			continue
		}
		var next []RosterEntry
		for _, e := range roster.Entries {
			if e.EmployeeID == o.EmployeeID && !e.Cover {
				next = append(next, subtractInterval(e, o.Start, o.End)...)
			} else {
				next = append(next, e)
			}
		}
		roster.Entries = next
		if !offIDs[o.CoverEmployeeID] {
			roster.Entries = append(roster.Entries, RosterEntry{
				EmployeeID: o.CoverEmployeeID, EmployeeName: o.CoverName, Start: o.Start, End: o.End, Cover: true})
		}
	}
	for _, o := range ovs {
		if o.Type == domain.OverrideWork && !offIDs[o.EmployeeID] {
			roster.Entries = append(roster.Entries, RosterEntry{
				EmployeeID: o.EmployeeID, EmployeeName: o.EmployeeName, Start: o.Start, End: o.End, Cover: true})
		}
	}
	sort.SliceStable(roster.Entries, func(i, j int) bool { return roster.Entries[i].Start < roster.Entries[j].Start })
	return roster, nil
}

// weekDates 는 오늘이 속한 주의 월~일 날짜 7개를 반환한다.
func (s *RosterService) weekDates() []string {
	now := s.clock()
	// time.Weekday: SUN=0..SAT=6 → 월요일 기준 오프셋
	offset := (int(now.Weekday()) + 6) % 7
	monday := now.AddDate(0, 0, -offset)
	dates := make([]string, 7)
	for i := range dates {
		dates[i] = monday.AddDate(0, 0, i).Format("2006-01-02")
	}
	return dates
}

// WeekRoster 는 이번 주(월~일) 7일의 예외 반영 명단을 반환한다.
func (s *RosterService) WeekRoster() ([]DayRoster, error) {
	out := make([]DayRoster, 0, 7)
	for _, date := range s.weekDates() {
		r, err := s.Roster(date)
		if err != nil {
			return nil, err
		}
		out = append(out, *r)
	}
	return out, nil
}

// WeekTotals 는 이번 주 예외 반영 배치 기준 직원별 총 시간을 (많은 순으로) 반환한다.
func (s *RosterService) WeekTotals() ([]EmployeeHours, error) {
	week, err := s.WeekRoster()
	if err != nil {
		return nil, err
	}
	byEmp := map[int64]*EmployeeHours{}
	for _, day := range week {
		for _, e := range day.Entries {
			t, ok := byEmp[e.EmployeeID]
			if !ok {
				t = &EmployeeHours{EmployeeID: e.EmployeeID, Name: e.EmployeeName}
				byEmp[e.EmployeeID] = t
			}
			t.Hours = math.Round((t.Hours+hoursBetween(e.Start, e.End))*100) / 100
		}
	}
	out := make([]EmployeeHours, 0, len(byEmp))
	for _, t := range byEmp {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Hours != out[j].Hours {
			return out[i].Hours > out[j].Hours
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}
