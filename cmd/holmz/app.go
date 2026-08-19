package main

import (
	"context"

	"holmz/internal/domain"
	"holmz/internal/service"
)

// App 은 Wails 프론트엔드에 노출되는 파사드다. window.go.main.App.* 로 호출된다.
type App struct {
	ctx       context.Context
	employees domain.EmployeeRepo
	worklog   *service.WorkLogService
	checklist *service.ChecklistService
	sync      *service.SyncService
	drive     domain.DrivePort
}

func NewApp(employees domain.EmployeeRepo, worklog *service.WorkLogService, checklist *service.ChecklistService,
	sync *service.SyncService, drive domain.DrivePort) *App {
	return &App{employees: employees, worklog: worklog, checklist: checklist, sync: sync, drive: drive}
}

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

// --- 직원 ---

func (a *App) ListEmployees(activeOnly bool) ([]domain.Employee, error) {
	return a.employees.List(activeOnly)
}

func (a *App) AddEmployee(name, pin string) (*domain.Employee, error) {
	e := &domain.Employee{Name: name, PIN: pin, Active: true}
	if err := a.employees.Create(e); err != nil {
		return nil, err
	}
	return e, nil
}

func (a *App) UpdateEmployee(e domain.Employee) error { return a.employees.Update(&e) }

// --- 근로기록 ---

func (a *App) ClockIn(employeeID int64) (*domain.WorkLog, error)  { return a.worklog.ClockIn(employeeID) }
func (a *App) ClockOut(employeeID int64) (*domain.WorkLog, error) { return a.worklog.ClockOut(employeeID) }
func (a *App) AddNote(employeeID int64, note string) error        { return a.worklog.AddNote(employeeID, note) }
func (a *App) CurrentShift(employeeID int64) (*domain.WorkLog, error) {
	return a.worklog.Current(employeeID)
}
func (a *App) WorkLogHistory(from, to string, employeeID int64) ([]domain.WorkLog, error) {
	return a.worklog.History(from, to, employeeID)
}

// --- 체크리스트 ---

func (a *App) TodayChecklist(typ string) (*service.ChecklistView, error) { return a.checklist.Today(typ) }
func (a *App) CheckItem(entryID int64, checked bool, by string) error {
	return a.checklist.Check(entryID, checked, by)
}
func (a *App) CompleteChecklist(typ, by string) error { return a.checklist.Complete(typ, by) }
func (a *App) ChecklistTemplates(typ string) ([]domain.ChecklistTemplate, error) {
	return a.checklist.Templates(typ)
}
func (a *App) AddChecklistTemplate(typ, name string, sortOrder int, required bool) (*domain.ChecklistTemplate, error) {
	return a.checklist.AddTemplate(typ, name, sortOrder, required)
}
func (a *App) UpdateChecklistTemplate(t domain.ChecklistTemplate) error {
	return a.checklist.UpdateTemplate(&t)
}
func (a *App) RemoveChecklistTemplate(id int64) error { return a.checklist.RemoveTemplate(id) }

// --- Google Drive 동기화 ---

func (a *App) GoogleAuthorized() bool { return a.drive.Authorized() }
func (a *App) GoogleAuthorize() error { return a.drive.Authorize() }
func (a *App) SyncNow() (*service.SyncResult, error) {
	return a.sync.SyncPending()
}
