package service

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"holmz/internal/domain"
)

const (
	stallTimeout = 45 * time.Second // heartbeat 무응답 허용 시간
	pauseTimeout = 60 * time.Second // 재생이 아닌 상태(일시정지·버퍼링)로 머무는 것을 봐주는 시간
	resumeGrace  = 20 * time.Second // 자동 재개를 지시한 뒤 재생 복귀를 기다리는 시간
	maxRetries   = 5                // 자동 재시작 최대 횟수 (초과 시 관리자 알림)
	watchdogTick = 15 * time.Second
)

// DefaultVolume 은 음량을 한 번도 조절하지 않았을 때 재생 창에 적용되는 값이다.
const DefaultVolume = 60

// keyVolume 은 음량 설정 저장 키다.
const keyVolume = "player_volume"

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
	repo     domain.PlaylistRepo
	settings domain.SettingsRepo
	emit     func(event string, data ...any)
	clock    func() time.Time

	mu sync.Mutex
	// playing 은 관리자가 재생을 시작시킨 상태이고, lastPlaying 은 팝업 창이 마지막으로
	// "실제로 재생 중"이라고 보고한 시각이다. 둘을 나눠야 일시정지를 감지할 수 있다.
	playing     bool
	lastBeat    time.Time
	lastPlaying time.Time
	resumeAt    time.Time // 자동 재개를 지시한 시각 (미지시 시 zero)
	retries     int
}

func NewPlayerService(repo domain.PlaylistRepo, settings domain.SettingsRepo,
	emit func(string, ...any), clock func() time.Time) *PlayerService {
	if clock == nil {
		clock = time.Now
	}
	if emit == nil {
		emit = func(string, ...any) {}
	}
	return &PlayerService{repo: repo, settings: settings, emit: emit, clock: clock}
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

// --- 음량 ---

// Volume 은 재생 창에 적용할 음량(0~100)이다. 미설정이면 DefaultVolume 을 쓴다.
func (s *PlayerService) Volume() (int, error) {
	v, err := s.settings.Get(keyVolume)
	if err != nil {
		return DefaultVolume, err
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return DefaultVolume, nil
	}
	return clampVolume(n), nil
}

// SetVolume 은 음량을 저장하고 재생 창에 즉시 반영되도록 이벤트를 발행한다.
// 창이 재로드되어도 저장값을 다시 읽으므로 음량이 유지된다.
func (s *PlayerService) SetVolume(v int) error {
	v = clampVolume(v)
	if err := s.settings.Set(keyVolume, strconv.Itoa(v)); err != nil {
		return err
	}
	s.emit("player:volume", v)
	return nil
}

func clampVolume(v int) int {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

// --- 재생 상태 / 워치독 ---

func (s *PlayerService) Start() {
	s.mu.Lock()
	s.playing = true
	s.lastBeat = s.clock()
	s.lastPlaying = s.lastBeat
	s.resumeAt = time.Time{}
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

// Heartbeat 은 프론트엔드 플레이어가 주기적으로 보고하는 상태다
// ("playing"/"paused"/"buffering"/"ended"/"unstarted"/"error").
// "error" 는 즉시 재시작을 시도하고, "playing" 만이 정상으로 인정되어 재시도 카운터를 리셋한다.
// 나머지 상태는 페이지가 살아 있다는 증거일 뿐이므로 멈춤 판정을 위해 그대로 흘려보낸다.
func (s *PlayerService) Heartbeat(state string) {
	s.mu.Lock()
	now := s.clock()
	s.lastBeat = now
	switch state {
	case "error":
		s.lastPlaying = now // 재로드로 다시 시작하므로 멈춤 판정 시계도 새로 준다
		s.resumeAt = time.Time{}
		s.restartLocked()
	case "playing":
		s.lastPlaying = now
		s.resumeAt = time.Time{}
		s.retries = 0
	}
	s.mu.Unlock()
}

// CheckStalled 은 재생이 멈춘 두 가지 경우를 감시한다.
//   - heartbeat 자체가 끊김 → 페이지가 죽었다고 보고 재시작
//   - heartbeat 은 오는데 재생 상태가 아님(일시정지·버퍼링·자동재생 차단) →
//     먼저 자동 재개를 지시하고, 그래도 안 돌아오면 재시작
func (s *PlayerService) CheckStalled() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.playing {
		return
	}
	now := s.clock()
	if now.Sub(s.lastBeat) > stallTimeout {
		s.lastBeat, s.lastPlaying, s.resumeAt = now, now, time.Time{}
		s.restartLocked()
		return
	}
	if now.Sub(s.lastPlaying) <= pauseTimeout {
		return
	}
	if s.resumeAt.IsZero() {
		s.resumeAt = now
		s.emit("player:resume")
		return
	}
	if now.Sub(s.resumeAt) > resumeGrace {
		s.lastPlaying, s.resumeAt = now, time.Time{}
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
