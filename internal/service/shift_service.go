package service

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"time"

	"holmz/internal/domain"
)

var (
	shiftWeekdays = []string{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
	timeRe        = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
	dateRe        = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

// DayShifts 는 한 요일의 근무 배치 목록이다 (주간 기본 배치 뷰).
type DayShifts struct {
	Weekday string         `json:"weekday"`
	Shifts  []domain.Shift `json:"shifts"`
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

// ShiftService 는 직원의 주간 반복 근무 배치(근로 스케줄)와 날짜별 예외를 관리한다.
type ShiftService struct {
	repo      domain.ShiftRepo
	overrides domain.ShiftOverrideRepo
	clock     func() time.Time
}

func NewShiftService(repo domain.ShiftRepo, overrides domain.ShiftOverrideRepo, clock func() time.Time) *ShiftService {
	if clock == nil {
		clock = time.Now
	}
	return &ShiftService{repo: repo, overrides: overrides, clock: clock}
}

func validTime(start, end string) error {
	if !timeRe.MatchString(start) || !timeRe.MatchString(end) {
		return fmt.Errorf("시간은 HH:MM 형식으로 입력하세요")
	}
	if start >= end {
		return fmt.Errorf("종료 시각은 시작 시각보다 늦어야 합니다")
	}
	return nil
}

// --- 주간 기본 배치 ---

// Add 는 요일·시간을 검증한 뒤 근무 배치를 등록한다.
func (s *ShiftService) Add(employeeID int64, weekday, start, end string) (*domain.Shift, error) {
	valid := false
	for _, d := range shiftWeekdays {
		if d == weekday {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("잘못된 요일입니다: %s", weekday)
	}
	if err := validTime(start, end); err != nil {
		return nil, err
	}
	shift := &domain.Shift{EmployeeID: employeeID, Weekday: weekday, Start: start, End: end}
	if err := s.repo.Create(shift); err != nil {
		return nil, err
	}
	return shift, nil
}

func (s *ShiftService) Remove(id int64) error { return s.repo.Delete(id) }

// Update 는 기존 배치의 직원·요일·시간을 검증 후 수정한다.
func (s *ShiftService) Update(id, employeeID int64, weekday, start, end string) error {
	valid := false
	for _, d := range shiftWeekdays {
		if d == weekday {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("잘못된 요일입니다: %s", weekday)
	}
	if err := validTime(start, end); err != nil {
		return err
	}
	return s.repo.Update(&domain.Shift{ID: id, EmployeeID: employeeID, Weekday: weekday, Start: start, End: end})
}

// Week 는 MON..SUN 순서로 7개 요일 전체(빈 요일 포함)의 기본 배치를 반환한다. 각 요일은 시작 시각순.
func (s *ShiftService) Week() ([]DayShifts, error) {
	all, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	byDay := map[string][]domain.Shift{}
	for _, sh := range all {
		byDay[sh.Weekday] = append(byDay[sh.Weekday], sh)
	}
	week := make([]DayShifts, 0, 7)
	for _, d := range shiftWeekdays {
		shifts := byDay[d]
		sort.SliceStable(shifts, func(i, j int) bool { return shifts[i].Start < shifts[j].Start })
		if shifts == nil {
			shifts = []domain.Shift{}
		}
		week = append(week, DayShifts{Weekday: d, Shifts: shifts})
	}
	return week, nil
}

// --- 날짜별 예외 (휴가·대타) ---

// AddOverride 는 특정 날짜의 휴가(off), 추가 근무(work), 대타/근무 변경(sub)을 등록한다.
// sub 는 coverEmployeeID(대신 근무하는 직원)와 시간 구간이 필수다.
func (s *ShiftService) AddOverride(employeeID int64, date, typ, start, end, note string, coverEmployeeID int64) (*domain.ShiftOverride, error) {
	if !dateRe.MatchString(date) {
		return nil, fmt.Errorf("날짜는 YYYY-MM-DD 형식으로 입력하세요")
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return nil, fmt.Errorf("잘못된 날짜입니다: %s", date)
	}
	switch typ {
	case domain.OverrideOff:
		start, end, coverEmployeeID = "", "", 0
	case domain.OverrideWork:
		coverEmployeeID = 0
		if err := validTime(start, end); err != nil {
			return nil, err
		}
	case domain.OverrideSub:
		if err := validTime(start, end); err != nil {
			return nil, err
		}
		if coverEmployeeID == 0 {
			return nil, fmt.Errorf("대신 근무할 직원을 선택하세요")
		}
		if coverEmployeeID == employeeID {
			return nil, fmt.Errorf("본인이 본인을 대신할 수 없습니다")
		}
	default:
		return nil, fmt.Errorf("잘못된 예외 유형입니다: %s", typ)
	}
	o := &domain.ShiftOverride{Date: date, EmployeeID: employeeID, Type: typ,
		Start: start, End: end, CoverEmployeeID: coverEmployeeID, Note: note}
	if err := s.overrides.Create(o); err != nil {
		return nil, err
	}
	return o, nil
}

func (s *ShiftService) RemoveOverride(id int64) error { return s.overrides.Delete(id) }

// UpcomingOverrides 는 오늘부터 90일 이내의 예외 목록을 반환한다.
func (s *ShiftService) UpcomingOverrides() ([]domain.ShiftOverride, error) {
	today := s.clock().Format("2006-01-02")
	to := s.clock().AddDate(0, 0, 90).Format("2006-01-02")
	return s.overrides.ListRange(today, to)
}

// --- 날짜 해석 (기본 배치 + 예외) ---

var goWeekdayToCode = map[time.Weekday]string{
	time.Monday: "MON", time.Tuesday: "TUE", time.Wednesday: "WED", time.Thursday: "THU",
	time.Friday: "FRI", time.Saturday: "SAT", time.Sunday: "SUN",
}

// Roster 는 해당 날짜의 실제 근무 명단을 반환한다: 요일 기본 배치 − 휴가자 + 대타.
func (s *ShiftService) Roster(date string) (*DayRoster, error) {
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

// weekDates 는 오늘이 속한 주의 월~일 날짜 7개를 반환한다.
func (s *ShiftService) weekDates() []string {
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
func (s *ShiftService) WeekRoster() ([]DayRoster, error) {
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

func hoursBetween(start, end string) float64 {
	toMin := func(t string) int {
		var h, m int
		fmt.Sscanf(t, "%d:%d", &h, &m)
		return h*60 + m
	}
	return math.Round(float64(toMin(end)-toMin(start))/60*100) / 100
}

// WeekTotals 는 이번 주 예외 반영 배치 기준 직원별 총 시간을 (많은 순으로) 반환한다.
func (s *ShiftService) WeekTotals() ([]EmployeeHours, error) {
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
