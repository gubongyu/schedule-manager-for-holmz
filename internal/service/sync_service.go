package service

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"holmz/internal/domain"
)

var ErrNotAuthorized = errors.New("Google 계정 인증이 필요합니다")

// SyncResult 는 동기화 실행 결과 요약이다.
type SyncResult struct {
	Uploaded int      `json:"uploaded"` // 업로드된 근로기록 건수
	Sheets   []string `json:"sheets"`   // 생성·갱신된 일자별 스프레드시트 URL
	Master   string   `json:"master"`   // 직원·근무스케줄 기준정보 시트 URL (꺼져 있으면 빈 값)
	Desk     string   `json:"desk"`     // 대여·분실물 시트 URL
}

// SyncService 는 로컬 pending 데이터를 날짜별 배치로 Google Drive에 업로드한다 (기획서 11장: 배치 업로드 전략).
// 근로기록 외에 직원 명단·근무 스케줄·예외도 기준정보 시트로 함께 동기화한다.
type SyncService struct {
	worklogs   domain.WorkLogRepo
	checklists domain.ChecklistRepo
	drive      domain.DrivePort
	employees  domain.EmployeeRepo
	shifts     domain.ShiftRepo
	overrides  domain.ShiftOverrideRepo
	rentals    domain.RentalRepo
	lostItems  domain.LostItemRepo
	targets    func() SyncTargets
	clock      func() time.Time
}

func NewSyncService(worklogs domain.WorkLogRepo, checklists domain.ChecklistRepo, drive domain.DrivePort,
	employees domain.EmployeeRepo, shifts domain.ShiftRepo, overrides domain.ShiftOverrideRepo,
	rentals domain.RentalRepo, lostItems domain.LostItemRepo, clock func() time.Time) *SyncService {
	if clock == nil {
		clock = time.Now
	}
	return &SyncService{worklogs: worklogs, checklists: checklists, drive: drive,
		employees: employees, shifts: shifts, overrides: overrides,
		rentals: rentals, lostItems: lostItems, clock: clock}
}

// SetTargetsProvider 는 동기화 항목 설정을 읽어올 함수를 지정한다.
// 지정하지 않으면 모든 항목을 동기화한다.
func (s *SyncService) SetTargetsProvider(fn func() SyncTargets) { s.targets = fn }

// enabled 는 현재 동기화 항목 설정이다.
func (s *SyncService) enabled() SyncTargets {
	if s.targets == nil {
		return AllSyncTargets()
	}
	return s.targets()
}

// syncMaster 는 직원·근무 스케줄·예외(오늘부터 90일)를 기준정보 시트로 업로드한다.
func (s *SyncService) syncMaster() (string, error) {
	employees, err := s.employees.List(false)
	if err != nil {
		return "", err
	}
	shifts, err := s.shifts.List()
	if err != nil {
		return "", err
	}
	today := s.clock().Format("2006-01-02")
	overrides, err := s.overrides.ListRange(today, s.clock().AddDate(0, 0, 90).Format("2006-01-02"))
	if err != nil {
		return "", err
	}
	return s.drive.UploadMaster(employees, shifts, overrides)
}

// syncDesk 는 HDMI 대여·분실물 기록을 데스크 시트로 업로드한다.
func (s *SyncService) syncDesk() (string, error) {
	rentals, err := s.rentals.List()
	if err != nil {
		return "", err
	}
	items, err := s.lostItems.List("")
	if err != nil {
		return "", err
	}
	return s.drive.UploadDesk(rentals, items)
}

// SyncPending 은 퇴근 완료된 미동기화 기록을 날짜별로 묶어 업로드하고, 성공한 날짜만 synced 처리한다.
func (s *SyncService) SyncPending() (*SyncResult, error) {
	if !s.drive.Authorized() {
		return nil, ErrNotAuthorized
	}
	on := s.enabled()
	res := &SyncResult{}
	if on.Worklog {
		if err := s.syncWorklogs(res); err != nil {
			return res, err
		}
	}
	if on.Master {
		masterURL, err := s.syncMaster()
		if err != nil {
			return res, fmt.Errorf("직원·스케줄 동기화 실패: %w", err)
		}
		res.Master = masterURL
	}
	if on.Desk {
		deskURL, err := s.syncDesk()
		if err != nil {
			return res, fmt.Errorf("대여·분실물 동기화 실패: %w", err)
		}
		res.Desk = deskURL
	}
	return res, nil
}

// syncWorklogs 는 미동기화 근로기록을 날짜별로 묶어 업로드한다.
func (s *SyncService) syncWorklogs(res *SyncResult) error {
	logs, err := s.worklogs.ListPending()
	if err != nil {
		return err
	}
	byDate := map[string][]domain.WorkLog{}
	for _, w := range logs {
		byDate[w.Date] = append(byDate[w.Date], w)
	}
	dates := make([]string, 0, len(byDate))
	for d := range byDate {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	for _, date := range dates {
		var entries []domain.ChecklistEntry
		for _, typ := range []string{"open", "close"} {
			es, err := s.checklists.ListEntries(date, typ)
			if err != nil {
				return err
			}
			entries = append(entries, es...)
		}
		url, err := s.drive.UploadDay(date, byDate[date], entries)
		if err != nil {
			return err
		}
		ids := make([]int64, len(byDate[date]))
		for i, w := range byDate[date] {
			ids[i] = w.ID
		}
		if err := s.worklogs.MarkSynced(ids); err != nil {
			return err
		}
		res.Uploaded += len(ids)
		res.Sheets = append(res.Sheets, url)
	}
	return nil
}
