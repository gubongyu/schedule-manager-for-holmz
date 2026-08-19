//go:build windows

package main

import (
	_ "embed"
	"log"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed tray.ico
var trayIcon []byte

// startTray 는 시스템 트레이 아이콘을 띄운다 (기획서 2.3: 상시 실행 및 시스템 트레이 상주).
// Windows에서는 systray 메시지 루프를 별도 goroutine에서 돌릴 수 있다 (macOS 제약 없음).
func startTray(a *App) {
	go systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTooltip("HOLMZ 근로 종합 관리")
		mOpen := systray.AddMenuItem("HOLMZ 열기", "창을 표시합니다")
		mSync := systray.AddMenuItem("지금 동기화", "근로기록을 Google Drive에 업로드합니다")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("종료", "프로그램을 완전히 종료합니다")
		go func() {
			for {
				select {
				case <-mOpen.ClickedCh:
					runtime.WindowShow(a.ctx)
				case <-mSync.ClickedCh:
					go func() {
						if _, err := a.sync.SyncPending(); err != nil {
							log.Printf("트레이 동기화 실패: %v", err)
						}
					}()
				case <-mQuit.ClickedCh:
					runtime.Quit(a.ctx)
					systray.Quit()
					return
				}
			}
		}()
	}, nil)
}
