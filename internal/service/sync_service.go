package service

import (
	"errors"
	"sort"

	"holmz/internal/domain"
)

var ErrNotAuthorized = errors.New("Google 계정 인증이 필요합니다")

// SyncResult 는 동기화 실행 결과 요약이다.
type SyncResult struct {
	Uploaded int      `json:"uploaded"` // 업로드된 근로기록 건수
	Sheets   []string `json:"sheets"`   // 생성·갱신된 스프레드시트 URL
}

// SyncService 는 로컬 pending 데이터를 날짜별 배치로 Google Drive에 업로드한다 (기획서 11장: 배치 업로드 전략).
type SyncService struct {
	worklogs   domain.WorkLogRepo
	checklists domain.ChecklistRepo
	drive      domain.DrivePort
}

func NewSyncService(worklogs domain.WorkLogRepo, checklists domain.ChecklistRepo, drive domain.DrivePort) *SyncService {
	return &SyncService{worklogs: worklogs, checklists: checklists, drive: drive}
}

// SyncPending 은 퇴근 완료된 미동기화 기록을 날짜별로 묶어 업로드하고, 성공한 날짜만 synced 처리한다.
func (s *SyncService) SyncPending() (*SyncResult, error) {
	if !s.drive.Authorized() {
		return nil, ErrNotAuthorized
	}
	logs, err := s.worklogs.ListPending()
	if err != nil {
		return nil, err
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

	res := &SyncResult{}
	for _, date := range dates {
		var entries []domain.ChecklistEntry
		for _, typ := range []string{"open", "close"} {
			es, err := s.checklists.ListEntries(date, typ)
			if err != nil {
				return res, err
			}
			entries = append(entries, es...)
		}
		url, err := s.drive.UploadDay(date, byDate[date], entries)
		if err != nil {
			return res, err
		}
		ids := make([]int64, len(byDate[date]))
		for i, w := range byDate[date] {
			ids[i] = w.ID
		}
		if err := s.worklogs.MarkSynced(ids); err != nil {
			return res, err
		}
		res.Uploaded += len(ids)
		res.Sheets = append(res.Sheets, url)
	}
	return res, nil
}
