package main

// 근로기록(출퇴근·업무 기록) 바인딩.

import "holmz/internal/domain"

func (a *App) ClockIn(employeeID int64) (*domain.WorkLog, error) {
	return a.worklog.ClockIn(employeeID)
}

func (a *App) ClockOut(employeeID int64) (*domain.WorkLog, error) {
	return a.worklog.ClockOut(employeeID)
}

func (a *App) AddNote(employeeID int64, note string) error {
	return a.worklog.AddNote(employeeID, note)
}

func (a *App) CurrentShift(employeeID int64) (*domain.WorkLog, error) {
	return a.worklog.Current(employeeID)
}

func (a *App) WorkLogHistory(from, to string, employeeID int64) ([]domain.WorkLog, error) {
	return a.worklog.History(from, to, employeeID)
}
