package main

// Google Drive 연동·동기화 바인딩.

import (
	"errors"

	"holmz/internal/service"
)

func (a *App) GoogleAuthorized() bool { return a.drive.Authorized() }

func (a *App) GoogleAuthorize() error { return a.drive.Authorize() }

func (a *App) SyncNow() (*service.SyncResult, error) { return a.sync.SyncPending() }

// GetSyncTargets 는 Drive 동기화 항목별 사용 여부다.
// Google 연동 전에는 어떤 항목도 실행되지 않으므로 모두 꺼진 것으로 보고한다.
func (a *App) GetSyncTargets() (service.SyncTargets, error) {
	if !a.drive.Authorized() {
		return service.SyncTargets{}, nil
	}
	return a.settings.SyncTargets()
}

// SetSyncTargets 는 동기화 항목 사용 여부를 저장한다 (연동 전에는 변경할 수 없다).
func (a *App) SetSyncTargets(t service.SyncTargets) error {
	if !a.drive.Authorized() {
		return errors.New("Google 계정 연동 후 설정할 수 있습니다")
	}
	return a.settings.SetSyncTargets(t)
}
