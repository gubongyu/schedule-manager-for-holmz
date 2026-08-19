package service

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"holmz/internal/domain"
)

const (
	stallTimeout = 45 * time.Second // heartbeat 무응답 허용 시간
	maxRetries   = 5                // 자동 재시작 최대 횟수 (초과 시 관리자 알림)
	watchdogTick = 15 * time.Second
)

var videoIDPatterns = []*regexp.Regexp{
	regexp.MustCompile(`[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)`),
	regexp.MustCompile(`youtu\.be/([A-Za-z0-9_-]{11})(?:[?&#]|$)`),
	regexp.MustCompile(`/embed/([A-Za-z0-9_-]{11})(?:[?&#]|$)`),
	regexp.MustCompile(`/shorts/([A-Za-z0-9_-]{11})(?:[?&#]|$)`),
}

// ParseVideoID 는 YouTube URL에서 11자리 영상 ID를 추출한다.
func ParseVideoID(url string) (string, error) {
	for _, p := range videoIDPatterns {
		if m := p.FindStringSubmatch(url); m != nil {
			return m[1], nil
		}
	}
	return "", fmt.Errorf("YouTube 영상 URL이 아닙니다: %s", url)
}

// PlayerService 는 재생목록 관리와 재생 상태 워치독을 담당한다.
// 실제 재생은 프론트엔드 YouTube IFrame Player가 수행하고, 이 서비스는
// heartbeat 로 상태를 감시해 이상 시 이벤트(player:reload / player:fatal)를 발행한다.
type PlayerService struct {
	repo  domain.PlaylistRepo
	emit  func(event string, data ...any)
	clock func() time.Time

	mu       sync.Mutex
	playing  bool
	lastBeat time.Time
	retries  int
}

func NewPlayerService(repo domain.PlaylistRepo, emit func(string, ...any), clock func() time.Time) *PlayerService {
	if clock == nil {
		clock = time.Now
	}
	if emit == nil {
		emit = func(string, ...any) {}
	}
	return &PlayerService{repo: repo, emit: emit, clock: clock}
}

// --- 재생목록 관리 ---

func (s *PlayerService) List() ([]domain.PlaylistItem, error) { return s.repo.List(false) }

func (s *PlayerService) ActiveList() ([]domain.PlaylistItem, error) { return s.repo.List(true) }

func (s *PlayerService) AddVideo(url, title string) (*domain.PlaylistItem, error) {
	id, err := ParseVideoID(url)
	if err != nil {
		return nil, err
	}
	existing, err := s.repo.List(false)
	if err != nil {
		return nil, err
	}
	item := &domain.PlaylistItem{SortOrder: len(existing) + 1, Title: title,
		VideoURL: url, VideoID: id, Active: true}
	if err := s.repo.Create(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *PlayerService) Remove(id int64) error { return s.repo.Delete(id) }

// --- 재생 상태 / 워치독 ---

func (s *PlayerService) Start() {
	s.mu.Lock()
	s.playing = true
	s.lastBeat = s.clock()
	s.retries = 0
	s.mu.Unlock()
	s.emit("player:start")
}

func (s *PlayerService) Stop() {
	s.mu.Lock()
	s.playing = false
	s.mu.Unlock()
	s.emit("player:stop")
}

func (s *PlayerService) IsPlaying() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.playing
}

// Heartbeat 은 프론트엔드 플레이어가 주기적으로 보고하는 상태다.
// "error" 는 즉시 재시작을 시도하고, 정상 상태는 재시도 카운터를 리셋한다.
func (s *PlayerService) Heartbeat(state string) {
	s.mu.Lock()
	s.lastBeat = s.clock()
	if state == "error" {
		s.restartLocked()
		s.mu.Unlock()
		return
	}
	s.retries = 0
	s.mu.Unlock()
}

// CheckStalled 은 재생 중인데 heartbeat 가 끊긴 경우 재시작을 지시한다.
func (s *PlayerService) CheckStalled() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.playing {
		return
	}
	if s.clock().Sub(s.lastBeat) > stallTimeout {
		s.lastBeat = s.clock()
		s.restartLocked()
	}
}

// restartLocked 은 s.mu 를 잡은 상태에서 호출해야 한다.
func (s *PlayerService) restartLocked() {
	s.retries++
	if s.retries > maxRetries {
		s.playing = false
		s.emit("player:fatal", "영상 재생을 복구하지 못했습니다. 네트워크와 재생목록을 확인해주세요.")
		return
	}
	s.emit("player:reload")
}

// RunWatchdog 은 주기적으로 CheckStalled 를 호출한다. 앱 시작 시 goroutine으로 실행한다.
func (s *PlayerService) RunWatchdog(ctx context.Context) {
	t := time.NewTicker(watchdogTick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.CheckStalled()
		}
	}
}
