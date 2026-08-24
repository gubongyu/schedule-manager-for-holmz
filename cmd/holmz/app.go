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
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/internal/adapter/speech"
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
	settings  domain.SettingsRepo
	announcer *speech.Announcer   // 합성 실패 시 대체용 내장 음성
	synth     *speech.Synthesizer // tts_program(MeloTTS) wav 생성

	photosDir     string
	startupAction string // --action 플래그로 전달된 자동화 동작
}

func NewApp(employees domain.EmployeeRepo, worklog *service.WorkLogService, checklist *service.ChecklistService,
	sync *service.SyncService, drive domain.DrivePort, schedule *service.ScheduleService,
	player *service.PlayerService, auth *service.AuthService, shifts *service.ShiftService,
	settings domain.SettingsRepo, photosDir, startupAction string) *App {
	return &App{employees: employees, worklog: worklog, checklist: checklist,
		sync: sync, drive: drive, schedule: schedule, player: player, auth: auth, shifts: shifts,
		settings: settings, announcer: speech.NewAnnouncer(),
		photosDir: photosDir, startupAction: startupAction}
}

// SetSynthesizer 는 안내 방송용 TTS 합성기를 주입한다 (main에서 설정 디렉터리를 알고 구성).
func (a *App) SetSynthesizer(s *speech.Synthesizer) { a.synth = s }

// --- 안내 방송 (텍스트 → 즉시 음성 송출, Windows 내장 TTS) ---

// AnnounceResult 는 방송 준비 결과다. AudioURL 이 있으면 프론트엔드가 그 음성을 재생하고,
// 비어 있으면(Fallback) 내장 음성으로 이미 송출된 것이다.
type AnnounceResult struct {
	AudioURL string `json:"audioUrl"`
	WavPath  string `json:"wavPath"`
	Fallback bool   `json:"fallback"`
	Message  string `json:"message"`
}

// Announce 는 입력 텍스트를 tts_program(MeloTTS)으로 합성해 재생용 음성을 돌려준다.
// 같은 문구·속도는 캐시된 wav를 재사용하며, 합성이 불가능하면 내장 음성으로 대체 송출한다.
// speed: 1.0이 보통 (tts_program --speed).
func (a *App) Announce(text string, speed float64) (*AnnounceResult, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("방송할 내용을 입력하세요")
	}
	if len([]rune(text)) > 500 {
		return nil, errors.New("방송 문구는 500자 이하로 입력하세요")
	}
	if speed <= 0 {
		speed = 1
	}
	if a.synth == nil {
		return nil, errors.New("TTS 합성기가 초기화되지 않았습니다")
	}

	wav, err := a.synth.WavFor(text, speed)
	if err != nil {
		log.Printf("TTS 합성 실패, 내장 음성으로 대체합니다: %v", err)
		if ferr := a.announcer.Speak(text, 0); ferr != nil {
			return nil, fmt.Errorf("%v (내장 음성도 실패: %v)", err, ferr)
		}
		return &AnnounceResult{Fallback: true, Message: err.Error()}, nil
	}
	url, err := a.AudioDataURL(wav)
	if err != nil {
		return nil, err
	}
	return &AnnounceResult{AudioURL: url, WavPath: wav}, nil
}

// TTSCommand 는 설정된 TTS 명령 템플릿을 반환한다 (미설정 시 기본값).
func (a *App) TTSCommand() (string, error) {
	v, err := a.settings.Get("tts_command")
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(v) == "" {
		return speech.DefaultCommand, nil
	}
	return v, nil
}

// SetTTSCommand 는 TTS 명령 템플릿을 저장한다. 빈 값이면 기본값을 사용한다.
func (a *App) SetTTSCommand(cmd string) error {
	return a.settings.Set("tts_command", strings.TrimSpace(cmd))
}

// ListAnnouncements 는 생성해 둔 안내 방송 목록을 최신순으로 반환한다.
func (a *App) ListAnnouncements() ([]speech.Cached, error) {
	if a.synth == nil {
		return nil, errors.New("TTS 합성기가 초기화되지 않았습니다")
	}
	return a.synth.List()
}

// DeleteAnnouncement 는 생성해 둔 안내 방송 음성을 삭제한다.
func (a *App) DeleteAnnouncement(wavPath string) error {
	if a.synth == nil {
		return errors.New("TTS 합성기가 초기화되지 않았습니다")
	}
	return a.synth.Delete(wavPath)
}

func (a *App) StopAnnounce()          { a.announcer.Stop() }
func (a *App) AnnounceSpeaking() bool { return a.announcer.Speaking() }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.player.RunWatchdog(ctx)
	startTray(a)
	if a.startupAction != "" {
		a.HandleAction(a.startupAction)
	}
}

// HandleAction 은 스케줄 트리거(--action=...)를 처리한다. 두 번째 인스턴스 실행 시에도 호출된다.
// play-audio 는 앱을 거치지 않고 작업 스케줄러가 Windows Media Player를 직접 실행한다.
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

func (a *App) AddEmployee(name, studentID, department string) (*domain.Employee, error) {
	e := &domain.Employee{Name: name, StudentID: studentID, Department: department, Active: true}
	if err := a.employees.Create(e); err != nil {
		return nil, err
	}
	return e, nil
}

// UpdateEmployee 는 이름·학번·학과를 갱신한다 (활성 상태는 보존).
func (a *App) UpdateEmployee(e domain.Employee) error {
	stored, err := a.employees.Get(e.ID)
	if err != nil {
		return err
	}
	stored.Name = e.Name
	stored.StudentID = e.StudentID
	stored.Department = e.Department
	return a.employees.Update(stored)
}

// DeleteEmployee 는 직원을 목록에서 제거한다 (기존 근로기록 보존을 위한 soft-delete).
func (a *App) DeleteEmployee(id int64) error {
	stored, err := a.employees.Get(id)
	if err != nil {
		return err
	}
	stored.Active = false
	return a.employees.Update(stored)
}

// --- 근로기록 ---

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

// --- 체크리스트 ---

func (a *App) TodayChecklist(typ string) (*service.ChecklistView, error) {
	return a.checklist.Today(typ)
}
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

// --- 본인 확인 (학번) / 관리자 PIN ---

func (a *App) EmployeeNeedsVerify(employeeID int64) (bool, error) {
	return a.auth.EmployeeNeedsVerify(employeeID)
}
func (a *App) VerifyEmployee(employeeID int64, studentID string) (bool, error) {
	return a.auth.VerifyEmployee(employeeID, studentID)
}

// Login 은 이름+학번(직원) 또는 이름+PIN(관리자)으로 접속을 인증한다. 실패 시 nil.
func (a *App) Login(name, secret string) (*service.LoginResult, error) {
	return a.auth.Login(name, secret)
}

func (a *App) AdminName() (string, error) { return a.auth.AdminName() }

// SetAdminAccount 은 현재 PIN 확인 후 관리자 이름·PIN을 변경한다 (빈 값은 유지).
func (a *App) SetAdminAccount(currentPIN, newName, newPIN string) error {
	ok, err := a.auth.VerifyAdminPIN(currentPIN)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("현재 관리자 PIN이 일치하지 않습니다")
	}
	if newName != "" {
		if err := a.auth.SetAdminName(newName); err != nil {
			return err
		}
	}
	if newPIN != "" {
		return a.auth.SetAdminPIN(newPIN)
	}
	return nil
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

// OpenCloseTimes 는 오늘 요일에 지정된 오픈/마감 시각을 반환한다 (지정 없으면 빈 문자열).
type OpenCloseTimes struct {
	Open  string `json:"open"`
	Close string `json:"close"`
}

var weekdayCodes = map[time.Weekday]string{
	time.Monday: "MON", time.Tuesday: "TUE", time.Wednesday: "WED", time.Thursday: "THU",
	time.Friday: "FRI", time.Saturday: "SAT", time.Sunday: "SUN",
}

func (a *App) TodayOpenClose() (*OpenCloseTimes, error) {
	open, close, err := a.schedule.OpenCloseFor(weekdayCodes[time.Now().Weekday()])
	if err != nil {
		return nil, err
	}
	return &OpenCloseTimes{Open: open, Close: close}, nil
}
func (a *App) ListSchedules() ([]domain.ScheduleItem, error) {
	return a.schedule.List()
}
func (a *App) AddSchedule(taskName, runTime string, repeatDays []string, actionType, payload string, repeat int) (*domain.ScheduleItem, error) {
	return a.schedule.Add(taskName, runTime, repeatDays, actionType, payload, repeat, true)
}

// --- 음성 재생 (안내방송) ---

var audioMimes = map[string]string{".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg"}

// PickAudioFile 은 파일 대화상자로 음성 파일을 선택해 경로를 반환한다. 취소 시 빈 문자열.
func (a *App) PickAudioFile() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "음성 파일 선택",
		Filters: []runtime.FileFilter{
			{DisplayName: "오디오 (*.mp3;*.wav;*.m4a;*.ogg)", Pattern: "*.mp3;*.wav;*.m4a;*.ogg"},
		},
	})
}

// AudioDataURL 은 음성 파일을 data URL로 반환한다 (WebView <audio> 재생용, 30MB 제한).
func (a *App) AudioDataURL(path string) (string, error) {
	mime, ok := audioMimes[strings.ToLower(filepath.Ext(path))]
	if !ok {
		return "", errors.New("지원하지 않는 오디오 형식입니다 (mp3/wav/m4a/ogg)")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("음성 파일을 열 수 없습니다: %w", err)
	}
	if info.Size() > 30<<20 {
		return "", errors.New("음성 파일이 너무 큽니다 (30MB 이하)")
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b), nil
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
func (a *App) UpdateShift(id, employeeID int64, weekday, start, end string) error {
	return a.shifts.Update(id, employeeID, weekday, start, end)
}

func (a *App) WeekRoster() ([]service.DayRoster, error)          { return a.shifts.WeekRoster() }
func (a *App) ShiftWeekTotals() ([]service.EmployeeHours, error) { return a.shifts.WeekTotals() }
func (a *App) ShiftOverrides() ([]domain.ShiftOverride, error) {
	return a.shifts.UpcomingOverrides()
}
func (a *App) AddShiftOverride(employeeID int64, date, typ, start, end, note string, coverEmployeeID int64) (*domain.ShiftOverride, error) {
	return a.shifts.AddOverride(employeeID, date, typ, start, end, note, coverEmployeeID)
}
func (a *App) DeleteShiftOverride(id int64) error { return a.shifts.RemoveOverride(id) }

// --- 앱 설정 (업무 항목 / 공지사항) ---

var defaultTaskOptions = []string{"청소", "재고 정리", "카운터·이용자 응대", "시설 점검", "기타"}

// GetTaskOptions 는 정각 업무 기록에 쓰이는 업무 항목 목록을 반환한다 (미설정 시 기본값).
func (a *App) GetTaskOptions() ([]string, error) {
	v, err := a.settings.Get("task_options")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(v) == "" {
		return defaultTaskOptions, nil
	}
	var out []string
	for _, line := range strings.Split(v, "\n") {
		if s := strings.TrimSpace(line); s != "" {
			out = append(out, s)
		}
	}
	return out, nil
}

func (a *App) SetTaskOptions(options []string) error {
	return a.settings.Set("task_options", strings.Join(options, "\n"))
}

// GetNotice 는 근무 시작 시 팝업으로 표시되는 공지사항이다.
func (a *App) GetNotice() (string, error) { return a.settings.Get("notice_text") }
func (a *App) SetNotice(text string) error {
	return a.settings.Set("notice_text", text)
}

// ShowWindow 는 트레이에 숨겨진 창을 표시한다 (정각 알림 등에서 사용).
func (a *App) ShowWindow() {
	if a.ctx != nil {
		runtime.WindowShow(a.ctx)
	}
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
func (a *App) PlayerStatus() bool                { return a.player.IsPlaying() }

// --- Google Drive 동기화 ---

func (a *App) GoogleAuthorized() bool { return a.drive.Authorized() }
func (a *App) GoogleAuthorize() error { return a.drive.Authorize() }
func (a *App) SyncNow() (*service.SyncResult, error) {
	return a.sync.SyncPending()
}
