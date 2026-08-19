package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/pkg/browser"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"holmz/frontend"
	"holmz/internal/adapter/googledrive"
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
	cfgDir := configDir()
	db, err := sqlite.Open(filepath.Join(cfgDir, "holmz.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	worklogRepo := sqlite.NewWorkLogRepo(db)
	checklistRepo := sqlite.NewChecklistRepo(db)
	drive := googledrive.New(cfgDir, browser.OpenURL)

	app := NewApp(
		sqlite.NewEmployeeRepo(db),
		service.NewWorkLogService(worklogRepo, nil),
		service.NewChecklistService(checklistRepo, nil),
		service.NewSyncService(worklogRepo, checklistRepo, drive),
		drive,
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
	})
	if err != nil {
		log.Fatal(err)
	}
}
