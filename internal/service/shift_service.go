package service

import (
	"fmt"
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
