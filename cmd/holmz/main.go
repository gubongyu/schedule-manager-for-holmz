package main

import (
	"flag"
	"log"
	"os"
	"path/filepath"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/frontend"
	"holmz/internal/adapter/googledrive"
	"holmz/internal/adapter/popup"
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
	action := flag.String("action", "", "스케줄 트리거 동작 (notify-open|notify-close|upload|play-start|play-stop)")
	flag.Parse()

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
	var popupSrv *popup.Server
	launcher := popup.NewLauncher(filepath.Join(cfgDir, "edge-player"))

	// 이벤트는 Wails 컨텍스트 준비 후에만 발행한다 (startup 이전 호출 가드).
	// 재생 상태 이벤트는 UI 알림과 동시에 팝업 창(Edge 앱 모드)을 제어한다.
	emit := func(event string, data ...any) {
		if app != nil && app.ctx != nil {
			runtime.EventsEmit(app.ctx, event, data...)
		}
		if popupSrv == nil {
			return
		}
		switch event {
		case "player:start":
			if err := launcher.Launch(popupSrv.PlayerURL()); err != nil {
				log.Printf("재생 창 실행 실패: %v", err)
			}
		case "player:stop", "player:fatal":
			popupSrv.Broadcast("stop")
			launcher.Kill()
		case "player:reload":
			// 프로세스 생존 여부는 신뢰할 수 없다 (Edge는 창이 닫혀도 백그라운드 프로세스가
			// 남을 수 있음). 재생 페이지가 실제 접속 중인지(SSE)로 판단한다.
			if popupSrv.ClientCount() > 0 {
				popupSrv.Broadcast("reload")
			} else {
				launcher.Kill()
				if err := launcher.Launch(popupSrv.PlayerURL()); err != nil {
					log.Printf("재생 창 재실행 실패: %v", err)
				}
			}
		}
	}

	playerSvc := service.NewPlayerService(sqlite.NewPlaylistRepo(db), emit, nil)
	if srv, err := popup.StartServer(playerSvc); err != nil {
		log.Printf("재생 팝업 서버 시작 실패: %v", err)
	} else {
		popupSrv = srv
		defer srv.Close()
		// 재생 창이 닫히거나 죽으면(연결 단절 + 유예 초과) 워치독 주기를 기다리지 않고 바로 되살린다.
		srv.SetOnClientsGone(func() {
			if !playerSvc.IsPlaying() {
				return
			}
			log.Printf("재생 창 연결이 끊겨 다시 실행합니다")
			launcher.Kill()
			if err := launcher.Launch(srv.PlayerURL()); err != nil {
				log.Printf("재생 창 재실행 실패: %v", err)
			}
		})
	}

	app = NewApp(
		employeeRepo,
		service.NewWorkLogService(worklogRepo, nil),
		checklistSvc,
		service.NewSyncService(worklogRepo, checklistRepo, drive),
		drive,
		service.NewScheduleService(sqlite.NewScheduleRepo(db), scheduler.New(exePath, nil),
			filepath.Join(cfgDir, "announce")),
		playerSvc,
		service.NewAuthService(employeeRepo, sqlite.NewSettingsRepo(db)),
		service.NewShiftService(sqlite.NewShiftRepo(db), sqlite.NewShiftOverrideRepo(db), nil),
		filepath.Join(cfgDir, "photos"),
		*action,
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
