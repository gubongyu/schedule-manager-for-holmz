// Package main 의 App 은 Wails 프론트엔드에 노출되는 파사드다.
// 기능별로 app_*.go 파일에 나뉘어 있으며, 각 메서드는 서비스·어댑터에 위임만 한다.
package main

import (
	"context"
	"log"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/internal/adapter/mediafile"
	"holmz/internal/adapter/speech"
	"holmz/internal/domain"
	"holmz/internal/service"
)

// App 은 window.go.main.App.* 로 호출되는 바인딩 대상이다.
type App struct {
	ctx context.Context

	employees domain.EmployeeRepo
	worklog   *service.WorkLogService
	checklist *service.ChecklistService
	sync      *service.SyncService
	drive     domain.DrivePort
	schedule  *service.ScheduleService
	player    *service.PlayerService
	auth      *service.AuthService
	shifts    *service.ShiftService
	roster    *service.RosterService
	settings  *service.SettingsService
	frontDesk *service.FrontDeskService
	update    *service.UpdateService

	photos    *mediafile.Store    // 체크리스트 첨부 사진 저장소
	announcer *speech.Announcer   // 합성 실패 시 대체용 내장 음성
	synth     *speech.Synthesizer // tts_program(MeloTTS) wav 생성

	startupAction string // --action 플래그로 전달된 자동화 동작
}

// Deps 는 App 조립에 필요한 구성요소다 (인자 나열이 길어져 구조체로 받는다).
type Deps struct {
	Employees domain.EmployeeRepo
	WorkLog   *service.WorkLogService
	Checklist *service.ChecklistService
	Sync      *service.SyncService
	Drive     domain.DrivePort
	Schedule  *service.ScheduleService
	Player    *service.PlayerService
	Auth      *service.AuthService
	Shifts    *service.ShiftService
	Roster    *service.RosterService
	Settings  *service.SettingsService
	FrontDesk *service.FrontDeskService
	Update    *service.UpdateService
	Photos    *mediafile.Store

	StartupAction string
}

func NewApp(d Deps) *App {
	return &App{
		employees: d.Employees, worklog: d.WorkLog, checklist: d.Checklist,
		sync: d.Sync, drive: d.Drive, schedule: d.Schedule, player: d.Player,
		auth: d.Auth, shifts: d.Shifts, roster: d.Roster, settings: d.Settings,
		frontDesk: d.FrontDesk, update: d.Update, photos: d.Photos,
		announcer:     speech.NewAnnouncer(),
		startupAction: d.StartupAction,
	}
}

// SetSynthesizer 는 안내 방송용 TTS 합성기를 주입한다 (main에서 설정 디렉터리를 알고 구성).
func (a *App) SetSynthesizer(s *speech.Synthesizer) { a.synth = s }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.player.RunWatchdog(ctx)
	go a.runUpdateChecks(ctx)
	// 교체 후 남은 이전 실행 파일을 정리한다 (이 시점엔 이전 프로세스가 이미 끝나 있다).
	a.update.CleanupOld()
	// 트레이 "종료"와 같은 순서로 완전히 끝낸다 — 프로세스가 남으면 새 버전이 뜨지 못한다.
	a.update.SetQuit(func() { runtime.Quit(ctx); stopTray() })
	startTray(a)
	if a.startupAction != "" {
		a.HandleAction(a.startupAction)
	}
}

// GetStartupAction 은 실행 시 전달된 자동화 동작을 프론트엔드에 알려준다.
func (a *App) GetStartupAction() string { return a.startupAction }

// ShowWindow 는 트레이에 숨겨진 창을 표시한다 (정각 알림 등에서 사용).
func (a *App) ShowWindow() {
	if a.ctx != nil {
		runtime.WindowShow(a.ctx)
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
