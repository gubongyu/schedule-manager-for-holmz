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

// defaultTemplates 는 최초 실행(템플릿이 하나도 없는 DB)에 채워지는 기본 점검 항목이다.
// 이후에는 관리자가 자유롭게 수정·삭제할 수 있으며, 다시 채워지지 않는다.
var defaultTemplates = struct {
	open, close []string
}{
	open: []string{
		"2,4층 냉난방기 전원 켜기 (온도: 계절별 적정 온도 참고)",
		"2,4층 공조기 전원 켜기",
		"2층 컴퓨터 전원 켠 후 노래 틀기",
		"2층 전자칠판(대형 모니터) 전원 켠 후 안내 동영상 재생",
		"2,4층 전자 안내판 전원 켠 후, 안내 동영상 재생",
	},
	close: []string{
		"요일 별 마감 층 확인",
		"30분, 10분 전 안내방송 송출 확인",
		"자율 방석 원위치",
		"의자 정리",
		"캐럴 내부 컴퓨터 전원 끄기",
		"2층 전자칠판(대형 모니터) 전원 끄기",
		"2,4층 전자 안내판 전원 끄기",
		"냉,난방기 및 공조기 전원 끄기 (캐럴 내부 확인 필수!)",
		"내부 전체 소등",
		"관리자 보고 후 문단속",
	},
}

// SeedDefaults 는 오픈/마감 템플릿이 모두 비어 있을 때만 기본 항목을 등록한다 (필수로 등록, 관리자가 조정 가능).
func (s *ChecklistService) SeedDefaults() error {
	for _, typ := range []string{"open", "close"} {
		existing, err := s.repo.ListTemplates(typ)
		if err != nil {
			return err
		}
		if len(existing) > 0 {
			return nil
		}
	}
	for typ, names := range map[string][]string{"open": defaultTemplates.open, "close": defaultTemplates.close} {
		for i, name := range names {
			t := &domain.ChecklistTemplate{Type: typ, Name: name, SortOrder: i + 1, Required: true, Active: true}
			if err := s.repo.CreateTemplate(t); err != nil {
				return err
			}
		}
	}
	return nil
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
