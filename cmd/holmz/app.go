package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
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
	auth      *service.AuthService
	shifts    *service.ShiftService

	photosDir     string
	startupAction string // --action 플래그로 전달된 자동화 동작
}

func NewApp(employees domain.EmployeeRepo, worklog *service.WorkLogService, checklist *service.ChecklistService,
	sync *service.SyncService, drive domain.DrivePort, schedule *service.ScheduleService,
	player *service.PlayerService, auth *service.AuthService, shifts *service.ShiftService,
	photosDir, startupAction string) *App {
	return &App{employees: employees, worklog: worklog, checklist: checklist,
		sync: sync, drive: drive, schedule: schedule, player: player, auth: auth, shifts: shifts,
		photosDir: photosDir, startupAction: startupAction}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.player.RunWatchdog(ctx)
	startTray(a)
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

// sanitizeEmployee 는 PIN 해시를 지우고 표시용 HasPIN 만 남긴다.
func sanitizeEmployee(e *domain.Employee) {
	e.HasPIN = e.PIN != ""
	e.PIN = ""
}

func (a *App) ListEmployees(activeOnly bool) ([]domain.Employee, error) {
	list, err := a.employees.List(activeOnly)
	if err != nil {
		return nil, err
	}
	for i := range list {
		sanitizeEmployee(&list[i])
	}
	return list, nil
}

func (a *App) AddEmployee(name, pin string) (*domain.Employee, error) {
	e := &domain.Employee{Name: name, Active: true}
	if err := a.employees.Create(e); err != nil {
		return nil, err
	}
	if pin != "" {
		if err := a.auth.SetEmployeePIN(e.ID, pin); err != nil {
			return nil, err
		}
		e.HasPIN = true
	}
	return e, nil
}

// UpdateEmployee 는 이름·활성 상태만 갱신한다. PIN 변경은 SetEmployeePIN 으로만 가능하다.
func (a *App) UpdateEmployee(e domain.Employee) error {
	stored, err := a.employees.Get(e.ID)
	if err != nil {
		return err
	}
	stored.Name = e.Name
	stored.Active = e.Active
	return a.employees.Update(stored)
}

// SetEmployeePIN 은 직원 PIN을 해시로 저장한다. 빈 값이면 해제.
func (a *App) SetEmployeePIN(employeeID int64, pin string) error {
	return a.auth.SetEmployeePIN(employeeID, pin)
}

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

// --- 체크리스트 사진 첨부 ---

var photoMimes = map[string]string{".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}

// AttachChecklistPhoto 는 파일 대화상자로 이미지를 골라 앱 사진 폴더에 복사하고 항목에 연결한다.
// 취소하면 빈 문자열을 반환한다.
func (a *App) AttachChecklistPhoto(entryID int64) (string, error) {
	sel, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "사진 선택",
		Filters: []runtime.FileFilter{
			{DisplayName: "이미지 (*.png;*.jpg;*.jpeg;*.webp)", Pattern: "*.png;*.jpg;*.jpeg;*.webp"},
		},
	})
	if err != nil || sel == "" {
		return "", err
	}
	ext := strings.ToLower(filepath.Ext(sel))
	if _, ok := photoMimes[ext]; !ok {
		return "", fmt.Errorf("지원하지 않는 이미지 형식입니다: %s", ext)
	}
	if err := os.MkdirAll(a.photosDir, 0o755); err != nil {
		return "", err
	}
	dest := filepath.Join(a.photosDir, fmt.Sprintf("entry_%d%s", entryID, ext))
	src, err := os.Open(sel)
	if err != nil {
		return "", err
	}
	defer src.Close()
	dst, err := os.Create(dest)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return "", err
	}
	if err := dst.Close(); err != nil {
		return "", err
	}
	if err := a.checklist.AttachPhoto(entryID, dest); err != nil {
		return "", err
	}
	return dest, nil
}

// RemoveChecklistPhoto 는 첨부를 해제하고 복사본 파일을 삭제한다.
func (a *App) RemoveChecklistPhoto(entryID int64, path string) error {
	if err := a.checklist.AttachPhoto(entryID, ""); err != nil {
		return err
	}
	if path != "" && filepath.Dir(filepath.Clean(path)) == filepath.Clean(a.photosDir) {
		_ = os.Remove(path)
	}
	return nil
}

// PhotoDataURL 은 앱 사진 폴더 내 이미지를 data URL로 반환한다 (WebView 표시용).
func (a *App) PhotoDataURL(path string) (string, error) {
	clean := filepath.Clean(path)
	if filepath.Dir(clean) != filepath.Clean(a.photosDir) {
		return "", errors.New("사진 폴더 밖의 파일은 열 수 없습니다")
	}
	mime, ok := photoMimes[strings.ToLower(filepath.Ext(clean))]
	if !ok {
		return "", errors.New("지원하지 않는 이미지 형식입니다")
	}
	b, err := os.ReadFile(clean)
	if err != nil {
		return "", err
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}

// --- PIN 인증 ---

func (a *App) EmployeeNeedsPIN(employeeID int64) (bool, error) {
	return a.auth.EmployeeNeedsPIN(employeeID)
}
func (a *App) VerifyEmployeePIN(employeeID int64, pin string) (bool, error) {
	return a.auth.VerifyEmployeePIN(employeeID, pin)
}
func (a *App) HasAdminPIN() (bool, error) { return a.auth.HasAdminPIN() }
func (a *App) VerifyAdminPIN(pin string) (bool, error) {
	return a.auth.VerifyAdminPIN(pin)
}

// SetAdminPIN 은 현재 PIN 확인 후 새 PIN을 저장한다. 빈 값이면 잠금 해제.
func (a *App) SetAdminPIN(currentPIN, newPIN string) error {
	ok, err := a.auth.VerifyAdminPIN(currentPIN)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("현재 관리자 PIN이 일치하지 않습니다")
	}
	return a.auth.SetAdminPIN(newPIN)
}

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

// --- 근로 스케줄 (주간 근무 배치) ---

func (a *App) ShiftWeek() ([]service.DayShifts, error) { return a.shifts.Week() }
func (a *App) AddShift(employeeID int64, weekday, start, end string) (*domain.Shift, error) {
	return a.shifts.Add(employeeID, weekday, start, end)
}
func (a *App) DeleteShift(id int64) error { return a.shifts.Remove(id) }

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
