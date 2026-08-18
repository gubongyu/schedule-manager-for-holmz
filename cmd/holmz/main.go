package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"holmz/frontend"
	"holmz/internal/repository/sqlite"
	"holmz/internal/service"
)

func dbPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	dir = filepath.Join(dir, "HOLMZ")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatal(err)
	}
	return filepath.Join(dir, "holmz.db")
}

func main() {
	db, err := sqlite.Open(dbPath())
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	app := NewApp(
		sqlite.NewEmployeeRepo(db),
		service.NewWorkLogService(sqlite.NewWorkLogRepo(db), nil),
		service.NewChecklistService(sqlite.NewChecklistRepo(db), nil),
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
