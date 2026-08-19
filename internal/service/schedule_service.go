package service

import (
	"fmt"

	"holmz/internal/domain"
)

// ScheduleService 는 스케줄을 로컬 DB와 OS 작업 스케줄러에 함께 반영한다.
type ScheduleService struct {
	repo domain.ScheduleRepo
	os   domain.TaskScheduler
}

func NewScheduleService(repo domain.ScheduleRepo, os domain.TaskScheduler) *ScheduleService {
	return &ScheduleService{repo: repo, os: os}
}

func (s *ScheduleService) List() ([]domain.ScheduleItem, error) { return s.repo.List() }

// Add 는 스케줄을 저장하고, 활성 항목이면 OS에 등록한다. OS 등록 실패 시 저장을 되돌린다.
func (s *ScheduleService) Add(taskName, runTime string, repeatDays []string, actionType string, active bool) (*domain.ScheduleItem, error) {
	item := &domain.ScheduleItem{TaskName: taskName, RunTime: runTime,
		RepeatDays: repeatDays, ActionType: actionType, Active: active}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	if active {
		if err := s.os.Register(*item); err != nil {
			_ = s.repo.Delete(item.ID)
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
		return s.os.Register(*item)
	}
	return s.os.Unregister(item.TaskName)
}

// Delete 는 OS 작업을 해제하고 스케줄을 삭제한다.
func (s *ScheduleService) Delete(id int64) error {
	item, err := s.get(id)
	if err != nil {
		return err
	}
	if err := s.os.Unregister(item.TaskName); err != nil {
		return err
	}
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
		if _, err := s.Add(it.name, it.time, nil, it.action, true); err != nil {
			return err
		}
	}
	return nil
}
