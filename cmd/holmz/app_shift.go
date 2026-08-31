package main

// 근로 스케줄(주간 근무 배치·휴가/대타) 바인딩.

import (
	"holmz/internal/domain"
	"holmz/internal/service"
)

func (a *App) ShiftWeek() ([]service.DayShifts, error) { return a.shifts.Week() }

func (a *App) AddShift(employeeID int64, weekday, start, end string) (*domain.Shift, error) {
	return a.shifts.Add(employeeID, weekday, start, end)
}

func (a *App) UpdateShift(id, employeeID int64, weekday, start, end string) error {
	return a.shifts.Update(id, employeeID, weekday, start, end)
}

func (a *App) DeleteShift(id int64) error { return a.shifts.Remove(id) }

// WeekRoster 는 이번 주 7일의 예외(휴가·대타) 반영 근무 명단이다.
func (a *App) WeekRoster() ([]service.DayRoster, error) { return a.roster.WeekRoster() }

func (a *App) ShiftWeekTotals() ([]service.EmployeeHours, error) { return a.roster.WeekTotals() }

func (a *App) ShiftOverrides() ([]domain.ShiftOverride, error) { return a.shifts.UpcomingOverrides() }

func (a *App) AddShiftOverride(employeeID int64, date, typ, start, end, note string, coverEmployeeID int64) (*domain.ShiftOverride, error) {
	return a.shifts.AddOverride(employeeID, date, typ, start, end, note, coverEmployeeID)
}

func (a *App) DeleteShiftOverride(id int64) error { return a.shifts.RemoveOverride(id) }
