package service

import (
	"fmt"
	"regexp"
	"sort"

	"holmz/internal/domain"
)

var (
	shiftWeekdays = []string{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}
	timeRe        = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
)

// DayShifts 는 한 요일의 근무 배치 목록이다 (주간 뷰 응답).
type DayShifts struct {
	Weekday string         `json:"weekday"`
	Shifts  []domain.Shift `json:"shifts"`
}

// ShiftService 는 직원의 주간 반복 근무 배치(근로 스케줄)를 관리한다.
type ShiftService struct {
	repo domain.ShiftRepo
}

func NewShiftService(repo domain.ShiftRepo) *ShiftService {
	return &ShiftService{repo: repo}
}

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
	if !timeRe.MatchString(start) || !timeRe.MatchString(end) {
		return nil, fmt.Errorf("시간은 HH:MM 형식으로 입력하세요")
	}
	if start >= end {
		return nil, fmt.Errorf("종료 시각은 시작 시각보다 늦어야 합니다")
	}
	shift := &domain.Shift{EmployeeID: employeeID, Weekday: weekday, Start: start, End: end}
	if err := s.repo.Create(shift); err != nil {
		return nil, err
	}
	return shift, nil
}

func (s *ShiftService) Remove(id int64) error { return s.repo.Delete(id) }

// Week 는 MON..SUN 순서로 7개 요일 전체(빈 요일 포함)의 배치를 반환한다. 각 요일은 시작 시각순.
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
