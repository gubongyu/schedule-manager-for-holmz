package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/frontend"
	"holmz/internal/adapter/githubrelease"
	"holmz/internal/adapter/googledrive"
	"holmz/internal/adapter/mediafile"
	"holmz/internal/adapter/popup"
	"holmz/internal/adapter/scheduler"
	"holmz/internal/adapter/speech"
	"holmz/internal/adapter/wmplaylist"
	"holmz/internal/repository/sqlite"
	"holmz/internal/service"
)

// version 은 빌드 시 -ldflags "-X main.version=v1.2.3" 로 주입한다.
// 주입하지 않은 개발 빌드는 "dev" 로 남고, 이 경우 업데이트 확인을 하지 않는다.
var version = service.DevVersion

// 업데이트를 배포하는 GitHub 저장소.
const (
	updateOwner = "gubongyu"
	updateRepo  = "schedule-manager-for-holmz"
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
	awaitExit := flag.Bool("await-exit", false, "업데이트 직후 실행됨 — 이전 프로세스 종료를 기다린다")
	flag.Parse()

	cfgDir := configDir()
	db, err := sqlite.Open(filepath.Join(cfgDir, "holmz.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	employeeRepo := sqlite.NewEmployeeRepo(db)
	settingsRepo := sqlite.NewSettingsRepo(db)
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
		case "player:volume":
			if len(data) > 0 {
				popupSrv.Broadcast(fmt.Sprintf("volume:%v", data[0]))
			}
		case "player:resume":
			// 일시정지·자동재생 차단으로 멈춘 화면을 재로드 전에 가볍게 깨운다.
			popupSrv.Broadcast("resume")
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

	updateSvc := service.NewUpdateService(githubrelease.New(updateOwner, updateRepo), version)
	// 업데이트로 새로 실행된 경우, 이전 프로세스가 끝나야 싱글 인스턴스 잠금이 풀린다.
	if *awaitExit {
		updateSvc.WaitForPredecessor()
	}

	playerSvc := service.NewPlayerService(sqlite.NewPlaylistRepo(db), sqlite.NewSettingsRepo(db), emit, nil)
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

	settingsSvc := service.NewSettingsService(settingsRepo)
	authSvc := service.NewAuthService(employeeRepo, settingsRepo)
	if err := authSvc.EnsureDefaultAdmin(); err != nil {
		log.Printf("초기 관리자 계정 생성 실패: %v", err)
	}

	announceDir := filepath.Join(cfgDir, "announce")
	rentalRepo := sqlite.NewRentalRepo(db)
	lostItemRepo := sqlite.NewLostItemRepo(db)
	shiftRepo := sqlite.NewShiftRepo(db)
	overrideRepo := sqlite.NewShiftOverrideRepo(db)

	app = NewApp(Deps{
		Employees: employeeRepo,
		WorkLog:   service.NewWorkLogService(worklogRepo, nil),
		Checklist: checklistSvc,
		Sync: service.NewSyncService(worklogRepo, checklistRepo, drive,
			employeeRepo, shiftRepo, overrideRepo, rentalRepo, lostItemRepo, nil),
		Drive: drive,
		Schedule: service.NewScheduleService(sqlite.NewScheduleRepo(db), scheduler.New(exePath, nil),
			wmplaylist.New(announceDir)),
		Player:        playerSvc,
		Auth:          authSvc,
		Shifts:        service.NewShiftService(shiftRepo, overrideRepo, nil),
		Roster:        service.NewRosterService(shiftRepo, overrideRepo, nil),
		Settings:      settingsSvc,
		FrontDesk:     service.NewFrontDeskService(rentalRepo, lostItemRepo, nil),
		Update:        updateSvc,
		Photos:        mediafile.NewStore(filepath.Join(cfgDir, "photos"), mediafile.PhotoMimes, 0),
		StartupAction: *action,
	})

	// 동기화 항목 설정은 매번 읽어, 관리자가 바꾼 값이 즉시 반영되게 한다.
	app.sync.SetTargetsProvider(func() service.SyncTargets {
		t, err := settingsSvc.SyncTargets()
		if err != nil {
			log.Printf("동기화 항목 설정 조회 실패: %v", err)
			return service.AllSyncTargets()
		}
		return t
	})

	// 합성기는 설정된 명령을 매번 읽어, 사용자가 바꾼 값이 재시작 없이 반영되게 한다.
	app.SetSynthesizer(speech.NewSynthesizer(announceDir, func() string {
		cmd, err := settingsSvc.TTSCommand("") // 빈 기본값 → 합성기가 플랫폼 기본 명령을 쓴다
		if err != nil {
			return ""
		}
		return cmd
	}))

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
