package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"holmz/internal/domain"
)

// ScheduleService 는 스케줄을 로컬 DB와 OS 작업 스케줄러에 함께 반영한다.
type ScheduleService struct {
	repo        domain.ScheduleRepo
	osSched     domain.TaskScheduler
	announceDir string // 연속 재생용 재생목록(.wpl) 저장 폴더
}

func NewScheduleService(repo domain.ScheduleRepo, osSched domain.TaskScheduler, announceDir string) *ScheduleService {
	return &ScheduleService{repo: repo, osSched: osSched, announceDir: announceDir}
}

func (s *ScheduleService) List() ([]domain.ScheduleItem, error) { return s.repo.List() }

// OpenCloseFor 는 해당 요일(MON..SUN)에 지정된 오픈/마감 시각을 반환한다.
// 활성화된 오픈/마감 체크리스트 알림 스케줄에서 도출하며, 지정이 없으면 빈 문자열이다.
// 요일 미지정(매일) 스케줄은 모든 요일에 적용된다.
func (s *ScheduleService) OpenCloseFor(weekday string) (open, close string, err error) {
	list, err := s.repo.List()
	if err != nil {
		return "", "", err
	}
	matches := func(item domain.ScheduleItem) bool {
		if !item.Active {
			return false
		}
		if len(item.RepeatDays) == 0 {
			return true
		}
		for _, d := range item.RepeatDays {
			if d == weekday {
				return true
			}
		}
		return false
	}
	for _, item := range list {
		if !matches(item) {
			continue
		}
		switch item.ActionType {
		case domain.ActionNotifyOpen:
			if open == "" {
				open = item.RunTime
			}
		case domain.ActionNotifyClose:
			if close == "" {
				close = item.RunTime
			}
		}
	}
	return open, close, nil
}

var xmlEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")

// writePlaylist 는 음성 파일을 Repeat 회 나열한 WMP 재생목록(.wpl)을 생성하고 경로를 반환한다.
func (s *ScheduleService) writePlaylist(item domain.ScheduleItem) (string, error) {
	if err := os.MkdirAll(s.announceDir, 0o755); err != nil {
		return "", err
	}
	var b strings.Builder
	b.WriteString("<?wpl version=\"1.0\"?>\n<smil>\n  <head><title>HOLMZ 안내방송</title></head>\n  <body><seq>\n")
	src := xmlEscaper.Replace(item.Payload)
	for i := 0; i < item.Repeat; i++ {
		fmt.Fprintf(&b, "    <media src=\"%s\"/>\n", src)
	}
	b.WriteString("  </seq></body>\n</smil>\n")
	path := filepath.Join(s.announceDir, fmt.Sprintf("schedule_%d.wpl", item.ID))
	return path, os.WriteFile(path, []byte(b.String()), 0o644)
}

func (s *ScheduleService) playlistPath(id int64) string {
	return filepath.Join(s.announceDir, fmt.Sprintf("schedule_%d.wpl", id))
}

// registerOS 는 OS에 작업을 등록한다. 연속 재생(Repeat>1)이면 재생목록을 만들어 그것을 등록한다.
func (s *ScheduleService) registerOS(item domain.ScheduleItem) error {
	if item.ActionType == domain.ActionPlayAudio && item.Repeat > 1 {
		p, err := s.writePlaylist(item)
		if err != nil {
			return fmt.Errorf("재생목록 생성 실패: %w", err)
		}
		item.Payload = p
	}
	return s.osSched.Register(item)
}

// Add 는 스케줄을 저장하고, 활성 항목이면 OS에 등록한다. OS 등록 실패 시 저장을 되돌린다.
// payload 는 동작별 부가 데이터로, play-audio(음성 재생)는 재생할 파일 경로가 필수다.
// repeat 는 play-audio의 연속 재생 횟수(1~5)다.
func (s *ScheduleService) Add(taskName, runTime string, repeatDays []string, actionType, payload string, repeat int, active bool) (*domain.ScheduleItem, error) {
	if actionType == domain.ActionPlayAudio {
		if payload == "" {
			return nil, fmt.Errorf("음성 재생 작업은 재생할 파일을 선택해야 합니다")
		}
		if repeat > 5 {
			return nil, fmt.Errorf("재생 횟수는 1~5회로 입력하세요")
		}
	}
	if repeat < 1 {
		repeat = 1
	}
	if actionType != domain.ActionPlayAudio {
		repeat = 1
	}
	item := &domain.ScheduleItem{TaskName: taskName, RunTime: runTime,
		RepeatDays: repeatDays, ActionType: actionType, Payload: payload, Repeat: repeat, Active: active}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	if active {
		if err := s.registerOS(*item); err != nil {
			_ = s.repo.Delete(item.ID)
			_ = os.Remove(s.playlistPath(item.ID))
			return nil, err
		}
	}
	return item, nil
}

func (s *ScheduleService) get(id int64) (*domain.ScheduleItem, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].ID == id {
			return &list[i], nil
		}
	}
	return nil, fmt.Errorf("스케줄을 찾을 수 없습니다 (id=%d)", id)
}

// Toggle 은 활성 상태를 바꾸고 OS 등록/해제를 동기화한다.
func (s *ScheduleService) Toggle(id int64, active bool) error {
	item, err := s.get(id)
	if err != nil {
		return err
	}
	item.Active = active
	if err := s.repo.Update(item); err != nil {
		return err
	}
	if active {
		return s.registerOS(*item)
	}
	return s.osSched.Unregister(item.TaskName)
}

// Delete 는 OS 작업을 해제하고 스케줄과 생성된 재생목록을 삭제한다.
func (s *ScheduleService) Delete(id int64) error {
	item, err := s.get(id)
	if err != nil {
		return err
	}
	if err := s.osSched.Unregister(item.TaskName); err != nil {
		return err
	}
	_ = os.Remove(s.playlistPath(id))
	return s.repo.Delete(id)
}

// ApplyTemplate 은 기획서 3.2의 대표 자동화 템플릿을 등록한다:
// 오픈 시각 — 체크리스트 알림 + 영상 재생 시작 / 마감 시각 — 체크리스트 알림 + 근로기록 업로드 + 영상 재생 종료.
func (s *ScheduleService) ApplyTemplate(openTime, closeTime string) error {
	items := []struct {
		name, time, action string
	}{
		{"오픈 체크리스트 알림", openTime, domain.ActionNotifyOpen},
		{"영상 재생 시작", openTime, domain.ActionPlayStart},
		{"마감 체크리스트 알림", closeTime, domain.ActionNotifyClose},
		{"근로기록 업로드", closeTime, domain.ActionUpload},
		{"영상 재생 종료", closeTime, domain.ActionPlayStop},
	}
	for _, it := range items {
		if _, err := s.Add(it.name, it.time, nil, it.action, "", 1, true); err != nil {
			return err
		}
	}
	return nil
}
