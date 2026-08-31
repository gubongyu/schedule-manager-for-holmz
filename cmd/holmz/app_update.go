package main

// 새 버전 확인 바인딩. 실제 다운로드·교체는 아직 하지 않고 알림까지만 담당한다.

import (
	"context"
	"log"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/internal/service"
)

// updateInterval 은 장시간 켜 둔 PC를 위한 재확인 주기다 (시작 시 확인은 프론트엔드가 한다).
const updateInterval = 24 * time.Hour

// AppVersion 은 실행 중인 빌드의 버전이다 (개발 빌드는 "dev").
func (a *App) AppVersion() string { return a.update.CurrentVersion() }

// CheckUpdate 는 새 버전을 조회한다. 새 버전이 없으면 null 을 반환한다.
func (a *App) CheckUpdate() (*service.Available, error) { return a.update.Check() }

// InstallUpdate 는 새 버전을 내려받아 실행 파일을 교체하고 프로그램을 다시 시작한다.
// 재생 창이 떠 있으면 먼저 정리한다 (교체 후 남은 창이 유령처럼 남지 않도록).
func (a *App) InstallUpdate() error {
	if a.player.IsPlaying() {
		a.player.Stop()
	}
	return a.update.Install()
}

// OpenReleasePage 는 릴리스 페이지를 기본 브라우저로 연다.
func (a *App) OpenReleasePage(url string) {
	if url == "" {
		return
	}
	runtime.BrowserOpenURL(a.ctx, url)
}

// runUpdateChecks 는 하루에 한 번 새 버전을 확인해 이벤트로 알린다.
// 조회 실패는 로그만 남긴다 — 네트워크 사정으로 매장 화면에 경고가 뜨면 곤란하다.
func (a *App) runUpdateChecks(ctx context.Context) {
	t := time.NewTicker(updateInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			av, err := a.update.Check()
			if err != nil {
				log.Printf("업데이트 확인 실패: %v", err)
				continue
			}
			if av != nil {
				runtime.EventsEmit(a.ctx, "update:available", av)
			}
		}
	}
}
