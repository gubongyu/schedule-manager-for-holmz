//go:build !windows

package main

// startTray 는 Windows 외 플랫폼에서는 아무것도 하지 않는다 (개발 환경용 스텁).
func startTray(a *App) {}
