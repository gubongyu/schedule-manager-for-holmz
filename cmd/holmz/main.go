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
	action := flag.String("action", "", "스케줄 트리거 동작 (notify-open|notify-close|upload|play-start|play-stop)")
	flag.Parse()

	cfgDir := configDir()
	db, err := sqlite.Open(filepath.Join(cfgDir, "holmz.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	worklogRepo := sqlite.NewWorkLogRepo(db)
	checklistRepo := sqlite.NewChecklistRepo(db)
	drive := googledrive.New(cfgDir, browser.OpenURL)

	exePath, err := os.Executable()
	if err != nil {
		exePath = os.Args[0]
	}

	app := NewApp(
		sqlite.NewEmployeeRepo(db),
		service.NewWorkLogService(worklogRepo, nil),
		service.NewChecklistService(checklistRepo, nil),
		service.NewSyncService(worklogRepo, checklistRepo, drive),
		drive,
		service.NewScheduleService(sqlite.NewScheduleRepo(db), scheduler.New(exePath, nil)),
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
