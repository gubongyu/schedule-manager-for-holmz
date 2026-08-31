package main

// Windows 작업 스케줄러 자동화 바인딩.

import (
	"time"

	"holmz/internal/domain"
)

// OpenCloseTimes 는 오늘 요일에 지정된 오픈/마감 시각이다 (지정 없으면 빈 문자열).
type OpenCloseTimes struct {
	Open  string `json:"open"`
	Close string `json:"close"`
}

var weekdayCodes = map[time.Weekday]string{
	time.Monday: "MON", time.Tuesday: "TUE", time.Wednesday: "WED", time.Thursday: "THU",
	time.Friday: "FRI", time.Saturday: "SAT", time.Sunday: "SUN",
}

// TodayOpenClose 는 오늘의 오픈/마감 시각을 반환한다 (체크리스트 메뉴 노출 판단용).
func (a *App) TodayOpenClose() (*OpenCloseTimes, error) {
	open, close, err := a.schedule.OpenCloseFor(weekdayCodes[time.Now().Weekday()])
	if err != nil {
		return nil, err
	}
	return &OpenCloseTimes{Open: open, Close: close}, nil
}

func (a *App) ListSchedules() ([]domain.ScheduleItem, error) { return a.schedule.List() }

func (a *App) AddSchedule(taskName, runTime string, repeatDays []string, actionType, payload string, repeat int) (*domain.ScheduleItem, error) {
	return a.schedule.Add(taskName, runTime, repeatDays, actionType, payload, repeat, true)
}

func (a *App) ToggleSchedule(id int64, active bool) error { return a.schedule.Toggle(id, active) }

func (a *App) DeleteSchedule(id int64) error { return a.schedule.Delete(id) }

func (a *App) ApplyScheduleTemplate(openTime, closeTime string) error {
	return a.schedule.ApplyTemplate(openTime, closeTime)
}
