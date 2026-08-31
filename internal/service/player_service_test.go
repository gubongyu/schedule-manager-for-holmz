package service

import (
	"path/filepath"
	"testing"
	"time"

	"holmz/internal/repository/sqlite"
)

func TestParseVideoID(t *testing.T) {
	cases := map[string]string{
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ":       "dQw4w9WgXcQ",
		"https://youtu.be/dQw4w9WgXcQ":                      "dQw4w9WgXcQ",
		"https://www.youtube.com/embed/dQw4w9WgXcQ":         "dQw4w9WgXcQ",
		"https://www.youtube.com/shorts/dQw4w9WgXcQ":        "dQw4w9WgXcQ",
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s": "dQw4w9WgXcQ",
	}
	for url, want := range cases {
		got, err := ParseVideoID(url)
		if err != nil || got != want {
			t.Errorf("ParseVideoID(%q) = %q, %v; want %q", url, got, err, want)
		}
	}
	for _, bad := range []string{"https://example.com/x", "not a url", "https://www.youtube.com/watch?v=short"} {
		if _, err := ParseVideoID(bad); err == nil {
			t.Errorf("ParseVideoID(%q) should fail", bad)
		}
	}
}

type emitRecorder struct{ events []string }

func (e *emitRecorder) emit(name string, data ...any) { e.events = append(e.events, name) }
func (e *emitRecorder) last() string {
	if len(e.events) == 0 {
		return ""
	}
	return e.events[len(e.events)-1]
}

type mutableClock struct{ now time.Time }

func (c *mutableClock) get() time.Time { return c.now }

func setupPlayer(t *testing.T) (*PlayerService, *emitRecorder, *mutableClock) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	rec := &emitRecorder{}
	clk := &mutableClock{now: time.Date(2026, 8, 19, 9, 0, 0, 0, time.UTC)}
	return NewPlayerService(sqlite.NewPlaylistRepo(db), sqlite.NewSettingsRepo(db), rec.emit, clk.get), rec, clk
}

func TestPlayerAddVideo(t *testing.T) {
	svc, _, _ := setupPlayer(t)
	item, err := svc.AddVideo("https://youtu.be/dQw4w9WgXcQ", "테스트 영상")
	if err != nil || item.VideoID != "dQw4w9WgXcQ" || item.SortOrder != 1 {
		t.Fatalf("AddVideo = %+v, err=%v", item, err)
	}
	if _, err := svc.AddVideo("https://example.com/no", "x"); err == nil {
		t.Error("invalid URL should fail")
	}
	list, _ := svc.List()
	if len(list) != 1 {
		t.Errorf("List = %d, want 1", len(list))
	}
}

func TestPlayerStartStop(t *testing.T) {
	svc, rec, _ := setupPlayer(t)
	svc.Start()
	if !svc.IsPlaying() || rec.last() != "player:start" {
		t.Errorf("after Start: playing=%v, last=%s", svc.IsPlaying(), rec.last())
	}
	svc.Stop()
	if svc.IsPlaying() || rec.last() != "player:stop" {
		t.Errorf("after Stop: playing=%v, last=%s", svc.IsPlaying(), rec.last())
	}
}

func TestWatchdogReloadsOnStall(t *testing.T) {
	svc, rec, clk := setupPlayer(t)
	svc.Start()

	// 정상 heartbeat → 조용
	svc.Heartbeat("playing")
	svc.CheckStalled()
	if rec.last() != "player:start" {
		t.Errorf("no stall expected, last=%s", rec.last())
	}

	// 46초 무응답 → reload
	clk.now = clk.now.Add(46 * time.Second)
	svc.CheckStalled()
	if rec.last() != "player:reload" {
		t.Errorf("stall should emit player:reload, last=%s", rec.last())
	}

	// heartbeat 재개 → 재시도 카운터 리셋
	svc.Heartbeat("playing")
	clk.now = clk.now.Add(10 * time.Second)
	svc.CheckStalled()
	if rec.last() != "player:reload" && rec.last() == "player:fatal" {
		t.Errorf("recovered player must not go fatal, last=%s", rec.last())
	}
}

func TestWatchdogFatalAfterMaxRetries(t *testing.T) {
	svc, rec, _ := setupPlayer(t)
	svc.Start()
	for i := 0; i < 5; i++ {
		svc.Heartbeat("error")
		if rec.last() != "player:reload" {
			t.Fatalf("retry %d: last=%s, want player:reload", i+1, rec.last())
		}
	}
	svc.Heartbeat("error") // 6번째 → fatal
	if rec.last() != "player:fatal" {
		t.Errorf("after 6 errors last=%s, want player:fatal", rec.last())
	}
	if svc.IsPlaying() {
		t.Error("fatal should stop playback expectation")
	}
}

// 일시정지된 채로 heartbeat 만 계속 오는 상황: 페이지는 살아 있으므로 stall 이 아니지만
// 화면은 멈춰 있다. 자동 재개를 먼저 지시하고, 그래도 안 돌아오면 재로드해야 한다.
func TestWatchdogResumesPausedPlayback(t *testing.T) {
	svc, rec, clk := setupPlayer(t)
	svc.Start()
	svc.Heartbeat("playing")

	// 일시정지 60초까지는 그대로 둔다 (광고·버퍼링 등 정상 범위).
	beat := func(state string, d time.Duration) {
		clk.now = clk.now.Add(d)
		svc.Heartbeat(state)
		svc.CheckStalled()
	}
	for i := 0; i < 6; i++ {
		beat("paused", 10*time.Second)
	}
	if rec.last() != "player:start" {
		t.Fatalf("60초 이내 일시정지는 건드리지 않아야 한다, last=%s", rec.last())
	}

	// 60초 초과 → 자동 재개 지시
	beat("paused", 10*time.Second)
	if rec.last() != "player:resume" {
		t.Fatalf("일시정지 지속 시 player:resume 이어야 한다, last=%s", rec.last())
	}

	// 재개 지시 후에도 계속 멈춰 있으면 → 재로드
	beat("paused", 10*time.Second)
	beat("paused", 10*time.Second)
	beat("paused", 10*time.Second)
	if rec.last() != "player:reload" {
		t.Fatalf("자동 재개 실패 시 player:reload 이어야 한다, last=%s", rec.last())
	}
}

// 재생으로 돌아오면 자동 재개 상태와 재시도 카운터가 리셋되어야 한다.
func TestPlayingHeartbeatClearsResumeState(t *testing.T) {
	svc, rec, clk := setupPlayer(t)
	svc.Start()
	for i := 0; i < 7; i++ {
		clk.now = clk.now.Add(10 * time.Second)
		svc.Heartbeat("paused")
		svc.CheckStalled()
	}
	if rec.last() != "player:resume" {
		t.Fatalf("사전 조건: player:resume, last=%s", rec.last())
	}

	clk.now = clk.now.Add(5 * time.Second)
	svc.Heartbeat("playing")
	for i := 0; i < 6; i++ {
		clk.now = clk.now.Add(10 * time.Second)
		svc.Heartbeat("playing")
		svc.CheckStalled()
	}
	if rec.last() != "player:resume" {
		t.Errorf("재생 복귀 후에는 추가 개입이 없어야 한다, last=%s", rec.last())
	}
}

func TestStoppedPlayerIgnoresStall(t *testing.T) {
	svc, rec, clk := setupPlayer(t)
	clk.now = clk.now.Add(10 * time.Minute)
	svc.CheckStalled()
	if rec.last() == "player:reload" {
		t.Error("stopped player must not reload")
	}
}

func TestPlayerVolumeDefaultAndClamp(t *testing.T) {
	svc, rec, _ := setupPlayer(t)

	v, err := svc.Volume()
	if err != nil || v != DefaultVolume {
		t.Fatalf("기본 음량 = %d, %v; want %d", v, err, DefaultVolume)
	}

	if err := svc.SetVolume(35); err != nil {
		t.Fatal(err)
	}
	if rec.last() != "player:volume" {
		t.Errorf("음량 변경은 player:volume 을 발행해야 한다, last=%s", rec.last())
	}
	if v, _ := svc.Volume(); v != 35 {
		t.Errorf("저장된 음량 = %d, want 35", v)
	}

	for _, c := range []struct{ set, want int }{{-10, 0}, {150, 100}} {
		if err := svc.SetVolume(c.set); err != nil {
			t.Fatal(err)
		}
		if v, _ := svc.Volume(); v != c.want {
			t.Errorf("SetVolume(%d) → %d, want %d", c.set, v, c.want)
		}
	}
}
