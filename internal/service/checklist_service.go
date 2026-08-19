package service

import (
	"errors"
	"time"

	"holmz/internal/domain"
)

var ErrRequiredUnchecked = errors.New("필수 항목이 완료되지 않았습니다")

// ChecklistView 는 특정 일자·구분의 체크리스트 화면 데이터다.
type ChecklistView struct {
	Date        string                  `json:"date"`
	Type        string                  `json:"type"`
	Entries     []domain.ChecklistEntry `json:"entries"`
	Completed   bool                    `json:"completed"`
	CompletedAt string                  `json:"completedAt"`
	CompletedBy string                  `json:"completedBy"`
}

type ChecklistService struct {
	repo  domain.ChecklistRepo
	clock func() time.Time
}

func NewChecklistService(repo domain.ChecklistRepo, clock func() time.Time) *ChecklistService {
	if clock == nil {
		clock = time.Now
	}
	return &ChecklistService{repo: repo, clock: clock}
}

// Today 는 오늘 날짜의 체크리스트를 (없으면 템플릿에서 생성 후) 반환한다.
func (s *ChecklistService) Today(typ string) (*ChecklistView, error) {
	date := s.clock().Format("2006-01-02")
	if err := s.repo.EnsureEntries(date, typ); err != nil {
		return nil, err
	}
	entries, err := s.repo.ListEntries(date, typ)
	if err != nil {
		return nil, err
	}
	view := &ChecklistView{Date: date, Type: typ, Entries: entries}
	if c, err := s.repo.GetCompletion(date, typ); err != nil {
		return nil, err
	} else if c != nil {
		view.Completed = true
		view.CompletedAt = c.CompletedAt
		view.CompletedBy = c.CompletedBy
	}
	return view, nil
}

// Check 는 항목 완료 여부를 토글한다.
func (s *ChecklistService) Check(entryID int64, checked bool, by string) error {
	return s.repo.SetChecked(entryID, checked, s.clock().Format(time.RFC3339), by)
}

// Complete 는 필수 항목이 모두 체크된 경우에만 오늘 체크리스트를 완료 처리한다.
func (s *ChecklistService) Complete(typ, by string) error {
	date := s.clock().Format("2006-01-02")
	entries, err := s.repo.ListEntries(date, typ)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.Required && !e.Checked {
			return ErrRequiredUnchecked
		}
	}
	return s.repo.SaveCompletion(&domain.ChecklistCompletion{
		Date: date, Type: typ,
		CompletedAt: s.clock().Format(time.RFC3339), CompletedBy: by,
	})
}

// AttachPhoto 는 항목의 첨부 사진 경로를 저장한다. 빈 경로면 첨부 해제.
func (s *ChecklistService) AttachPhoto(entryID int64, path string) error {
	return s.repo.SetPhoto(entryID, path)
}

// --- 관리자용 템플릿 관리 ---

func (s *ChecklistService) AddTemplate(typ, name string, sortOrder int, required bool) (*domain.ChecklistTemplate, error) {
	t := &domain.ChecklistTemplate{Type: typ, Name: name, SortOrder: sortOrder, Required: required, Active: true}
	if err := s.repo.CreateTemplate(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *ChecklistService) UpdateTemplate(t *domain.ChecklistTemplate) error {
	return s.repo.UpdateTemplate(t)
}

func (s *ChecklistService) RemoveTemplate(id int64) error {
	return s.repo.DeleteTemplate(id)
}

func (s *ChecklistService) Templates(typ string) ([]domain.ChecklistTemplate, error) {
	return s.repo.ListTemplates(typ)
}
