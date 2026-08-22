package popup

import (
	"bufio"
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
	"holmz/internal/service"
)

type emitRec struct{ events []string }

func (e *emitRec) emit(name string, data ...any) { e.events = append(e.events, name) }

func setupServer(t *testing.T) (*Server, *service.PlayerService, *emitRec) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	repo := sqlite.NewPlaylistRepo(db)
	if err := repo.Create(&domain.PlaylistItem{SortOrder: 1, Title: "t", VideoURL: "u", VideoID: "dQw4w9WgXcQ", Active: true}); err != nil {
		t.Fatal(err)
	}
	rec := &emitRec{}
	player := service.NewPlayerService(repo, rec.emit, nil)
	srv, err := StartServer(player)
	if err != nil {
		t.Fatalf("StartServer: %v", err)
	}
	t.Cleanup(srv.Close)
	return srv, player, rec
}

func TestServerServesPlaylistAndPage(t *testing.T) {
	srv, _, _ := setupServer(t)

	resp, err := http.Get(srv.PlayerURL())
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("GET /player = %v, err=%v", resp, err)
	}
	resp.Body.Close()

	resp, err = http.Get(srv.base + "/api/playlist")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var items []domain.PlaylistItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil || len(items) != 1 || items[0].VideoID != "dQw4w9WgXcQ" {
		t.Fatalf("playlist = %+v, err=%v", items, err)
	}
}

func TestServerHeartbeatFeedsWatchdog(t *testing.T) {
	srv, player, rec := setupServer(t)
	player.Start() // playing 상태로 만들고 emit 기록 초기화 기준점

	body := strings.NewReader(`{"state":"error"}`)
	resp, err := http.Post(srv.base+"/api/heartbeat", "application/json", body)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("POST heartbeat = %v, err=%v", resp, err)
	}
	resp.Body.Close()
	// error heartbeat → 워치독이 재시작 이벤트 발행
	found := false
	for _, e := range rec.events {
		if e == "player:reload" {
			found = true
		}
	}
	if !found {
		t.Errorf("error heartbeat should emit player:reload, got %v", rec.events)
	}
}

func TestClientCountAndDisconnectCallback(t *testing.T) {
	srv, _, _ := setupServer(t)
	srv.emptyDelay = 100 * time.Millisecond // 테스트용 짧은 유예

	gone := make(chan struct{}, 1)
	srv.SetOnClientsGone(func() { gone <- struct{}{} })

	if srv.ClientCount() != 0 {
		t.Fatalf("initial ClientCount = %d, want 0", srv.ClientCount())
	}

	// SSE 접속 → count 1
	req, _ := http.NewRequest("GET", srv.base+"/api/events", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
	if srv.ClientCount() != 1 {
		t.Fatalf("ClientCount after connect = %d, want 1", srv.ClientCount())
	}

	// 접속 종료 → 유예 후 콜백
	resp.Body.Close()
	select {
	case <-gone:
	case <-time.After(3 * time.Second):
		t.Fatal("OnClientsGone not called after disconnect")
	}
	if srv.ClientCount() != 0 {
		t.Errorf("ClientCount after disconnect = %d, want 0", srv.ClientCount())
	}
}

func TestServerBroadcastSSE(t *testing.T) {
	srv, _, _ := setupServer(t)

	resp, err := http.Get(srv.base + "/api/events")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	time.Sleep(50 * time.Millisecond) // 구독 등록 대기
	srv.Broadcast("reload")

	lineCh := make(chan string, 1)
	go func() {
		sc := bufio.NewScanner(resp.Body)
		for sc.Scan() {
			if strings.HasPrefix(sc.Text(), "data: ") {
				lineCh <- sc.Text()
				return
			}
		}
	}()
	select {
	case line := <-lineCh:
		if line != "data: reload" {
			t.Errorf("SSE line = %q, want data: reload", line)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("SSE broadcast not received")
	}
}
