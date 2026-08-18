// Package service 는 HOLMZ 애플리케이션 유스케이스 계층이다.
package service

import (
	"errors"
	"time"

	"holmz/internal/domain"
)

var (
	ErrShiftAlreadyOpen = errors.New("이미 출근 처리된 근무가 있습니다")
	ErrNoOpenShift      = errors.New("출근 처리된 근무가 없습니다")
)

type WorkLogService struct {
	repo  domain.WorkLogRepo
	clock func() time.Time
}

func NewWorkLogService(repo domain.WorkLogRepo, clock func() time.Time) *WorkLogService {
	if clock == nil {
		clock = time.Now
	}
	return &WorkLogService{repo: repo, clock: clock}
}

// ClockIn 은 출근을 기록한다. 미종료 근무가 있으면 실패한다.
func (s *WorkLogService) ClockIn(employeeID int64) (*domain.WorkLog, error) {
	open, err := s.repo.GetOpen(employeeID)
	if err != nil {
		return nil, err
	}
	if open != nil {
		return nil, ErrShiftAlreadyOpen
	}
	now := s.clock()
	w := &domain.WorkLog{
		EmployeeID: employeeID,
		Date:       now.Format("2006-01-02"),
		ClockIn:    now.Format(time.RFC3339),
		SyncStatus: "pending",
	}
	if err := s.repo.Create(w); err != nil {
		return nil, err
	}
	return w, nil
}

// ClockOut 은 퇴근을 기록하고 총 근무시간을 계산한다.
func (s *WorkLogService) ClockOut(employeeID int64) (*domain.WorkLog, error) {
	open, err := s.repo.GetOpen(employeeID)
	if err != nil {
		return nil, err
	}
	if open == nil {
		return nil, ErrNoOpenShift
	}
	open.ClockOut = s.clock().Format(time.RFC3339)
	open.TotalHrs = open.TotalHours()
	if err := s.repo.Update(open); err != nil {
		return nil, err
	}
	return open, nil
}

// AddNote 는 진행 중 근무에 업무 내용을 줄 단위로 누적한다.
func (s *WorkLogService) AddNote(employeeID int64, note string) error {
	open, err := s.repo.GetOpen(employeeID)
	if err != nil {
		return err
	}
	if open == nil {
		return ErrNoOpenShift
	}
	if open.TaskNotes == "" {
		open.TaskNotes = note
	} else {
		open.TaskNotes += "\n" + note
	}
	return s.repo.Update(open)
}

// Current 는 진행 중 근무를 반환한다. 없으면 nil.
func (s *WorkLogService) Current(employeeID int64) (*domain.WorkLog, error) {
	return s.repo.GetOpen(employeeID)
}

// History 는 기간·직원 필터로 근로기록을 조회한다 (관리자 화면용).
func (s *WorkLogService) History(from, to string, employeeID int64) ([]domain.WorkLog, error) {
	return s.repo.List(from, to, employeeID)
}
