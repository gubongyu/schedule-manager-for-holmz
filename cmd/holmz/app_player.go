package main

// 영상 재생(재생목록·재생 제어) 바인딩. 실제 재생은 팝업 창이 담당한다.

import "holmz/internal/domain"

func (a *App) PlaylistItems() ([]domain.PlaylistItem, error) { return a.player.List() }

func (a *App) ActivePlaylist() ([]domain.PlaylistItem, error) { return a.player.ActiveList() }

func (a *App) AddPlaylistItem(url, title string) (*domain.PlaylistItem, error) {
	return a.player.AddVideo(url, title)
}

func (a *App) RemovePlaylistItem(id int64) error { return a.player.Remove(id) }

func (a *App) StartPlayback() { a.player.Start() }

func (a *App) StopPlayback() { a.player.Stop() }

func (a *App) PlayerStatus() bool { return a.player.IsPlaying() }

// PlayerVolume 은 재생 창에 적용되는 음량(0~100)이다.
func (a *App) PlayerVolume() (int, error) { return a.player.Volume() }

func (a *App) SetPlayerVolume(v int) error { return a.player.SetVolume(v) }
