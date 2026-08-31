package main

// 앱 설정(업무 항목·공지사항·TTS 명령) 바인딩.

import (
	"holmz/internal/adapter/speech"
	"holmz/internal/service"
)

// GetTaskOptions 는 정각 업무 기록에 쓰이는 업무 항목 목록이다 (미설정 시 기본값).
func (a *App) GetTaskOptions() ([]string, error) { return a.settings.TaskOptions() }

func (a *App) SetTaskOptions(options []string) error { return a.settings.SetTaskOptions(options) }

// GetNotice 는 근무 시작 시 팝업으로 표시되는 공지사항이다.
func (a *App) GetNotice() (string, error) { return a.settings.Notice() }

func (a *App) SetNotice(text string) error { return a.settings.SetNotice(text) }

// TTSCommand 는 안내 방송 음성 생성 명령이다 (미설정 시 플랫폼 기본값).
func (a *App) TTSCommand() (string, error) { return a.settings.TTSCommand(speech.DefaultCommand) }

func (a *App) SetTTSCommand(cmd string) error { return a.settings.SetTTSCommand(cmd) }

// GetFeatures 는 화면 단위로 켜고 끌 수 있는 기능들의 사용 여부다.
func (a *App) GetFeatures() (service.Features, error) { return a.settings.Features() }

func (a *App) SetFeatures(f service.Features) error { return a.settings.SetFeatures(f) }
