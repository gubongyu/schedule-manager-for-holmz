package main

import (
	"flag"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/frontend"
	"holmz/internal/adapter/googledrive"
	"holmz/internal/adapter/scheduler"
	"holmz/internal/repository/sqlite"
	"holmz/internal/service"
)

func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	dir = filepath.Join(dir, "HOLMZ")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatal(err)
	}
	return dir
}

func main() {
	action := flag.String("action", "", "스케줄 트리거 동작 (notify-open|notify-close|upload|play-start|play-stop|play-audio)")
	payload := flag.String("payload", "", "동작 부가 데이터 (play-audio: 음성 파일 경로)")
	flag.Parse()

	// 스케줄 트리거로 사용자 조작 없이 안내방송을 틀어야 하므로 WebView2 자동재생 제한을 해제한다.
	os.Setenv("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--autoplay-policy=no-user-gesture-required")

	cfgDir := configDir()
	db, err := sqlite.Open(filepath.Join(cfgDir, "holmz.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	employeeRepo := sqlite.NewEmployeeRepo(db)
	worklogRepo := sqlite.NewWorkLogRepo(db)
	checklistRepo := sqlite.NewChecklistRepo(db)
	checklistSvc := service.NewChecklistService(checklistRepo, nil)
	if err := checklistSvc.SeedDefaults(); err != nil {
		log.Printf("기본 체크리스트 등록 실패: %v", err)
	}
	drive := googledrive.New(cfgDir, browser.OpenURL)

	exePath, err := os.Executable()
	if err != nil {
		exePath = os.Args[0]
	}

	var app *App
	// 이벤트는 Wails 컨텍스트 준비 후에만 발행한다 (startup 이전 호출 가드).
	emit := func(event string, data ...any) {
		if app != nil && app.ctx != nil {
			runtime.EventsEmit(app.ctx, event, data...)
		}
	}

	app = NewApp(
		employeeRepo,
		service.NewWorkLogService(worklogRepo, nil),
		checklistSvc,
		service.NewSyncService(worklogRepo, checklistRepo, drive),
		drive,
		service.NewScheduleService(sqlite.NewScheduleRepo(db), scheduler.New(exePath, nil)),
		service.NewPlayerService(sqlite.NewPlaylistRepo(db), emit, nil),
		service.NewAuthService(employeeRepo, sqlite.NewSettingsRepo(db)),
		service.NewShiftService(sqlite.NewShiftRepo(db), sqlite.NewShiftOverrideRepo(db), nil),
		filepath.Join(cfgDir, "photos"),
		*action,
		strings.Trim(*payload, `"`),
	)

	err = wails.Run(&options.App{
		Title:  "HOLMZ 근로 종합 관리",
		Width:  1100,
		Height: 760,
		AssetServer: &assetserver.Options{
			Assets: frontend.Assets,
		},
		OnStartup: app.startup,
		Bind:      []any{app},
		// 창을 닫아도 종료하지 않고 트레이에 상주한다. 종료는 트레이 메뉴의 "종료"로.
		HideWindowOnClose: true,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "holmz-schedule-manager",
			OnSecondInstanceLaunch: func(data options.SecondInstanceData) {
				app.onSecondInstance(data.Args)
			},
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
