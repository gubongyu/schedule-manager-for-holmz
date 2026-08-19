package main

import (
	"context"
	"log"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

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
	schedule  *service.ScheduleService
	player    *service.PlayerService

	startupAction string // --action 플래그로 전달된 자동화 동작
}

func NewApp(employees domain.EmployeeRepo, worklog *service.WorkLogService, checklist *service.ChecklistService,
	sync *service.SyncService, drive domain.DrivePort, schedule *service.ScheduleService,
	player *service.PlayerService, startupAction string) *App {
	return &App{employees: employees, worklog: worklog, checklist: checklist,
		sync: sync, drive: drive, schedule: schedule, player: player, startupAction: startupAction}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.player.RunWatchdog(ctx)
	if a.startupAction != "" {
		a.HandleAction(a.startupAction)
	}
}

// HandleAction 은 스케줄 트리거(--action=...)를 처리한다. 두 번째 인스턴스 실행 시에도 호출된다.
func (a *App) HandleAction(action string) {
	switch action {
	case domain.ActionUpload:
		go func() {
			if _, err := a.sync.SyncPending(); err != nil {
				log.Printf("자동 업로드 실패: %v", err)
			}
		}()
	case domain.ActionPlayStart:
		a.player.Start()
	case domain.ActionPlayStop:
		a.player.Stop()
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "schedule:action", action)
		runtime.WindowShow(a.ctx)
	}
}

// onSecondInstance 는 스케줄러가 앱을 다시 실행했을 때 인자에서 동작을 꺼내 처리한다.
func (a *App) onSecondInstance(args []string) {
	for _, arg := range args {
		if v, ok := strings.CutPrefix(arg, "--action="); ok {
			a.HandleAction(v)
		}
	}
}

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

// --- 스케줄 ---

func (a *App) GetStartupAction() string { return a.startupAction }
func (a *App) ListSchedules() ([]domain.ScheduleItem, error) {
	return a.schedule.List()
}
func (a *App) AddSchedule(taskName, runTime string, repeatDays []string, actionType string) (*domain.ScheduleItem, error) {
	return a.schedule.Add(taskName, runTime, repeatDays, actionType, true)
}
func (a *App) ToggleSchedule(id int64, active bool) error { return a.schedule.Toggle(id, active) }
func (a *App) DeleteSchedule(id int64) error              { return a.schedule.Delete(id) }
func (a *App) ApplyScheduleTemplate(openTime, closeTime string) error {
	return a.schedule.ApplyTemplate(openTime, closeTime)
}

// --- 영상 재생 ---

func (a *App) PlaylistItems() ([]domain.PlaylistItem, error) { return a.player.List() }
func (a *App) ActivePlaylist() ([]domain.PlaylistItem, error) {
	return a.player.ActiveList()
}
func (a *App) AddPlaylistItem(url, title string) (*domain.PlaylistItem, error) {
	return a.player.AddVideo(url, title)
}
func (a *App) RemovePlaylistItem(id int64) error { return a.player.Remove(id) }
func (a *App) StartPlayback()                    { a.player.Start() }
func (a *App) StopPlayback()                     { a.player.Stop() }
func (a *App) PlayerHeartbeat(state string)      { a.player.Heartbeat(state) }
func (a *App) PlayerStatus() bool                { return a.player.IsPlaying() }

// --- Google Drive 동기화 ---

func (a *App) GoogleAuthorized() bool { return a.drive.Authorized() }
func (a *App) GoogleAuthorize() error { return a.drive.Authorize() }
func (a *App) SyncNow() (*service.SyncResult, error) {
	return a.sync.SyncPending()
}
