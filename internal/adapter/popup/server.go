// Package popup 은 영상 재생 팝업 창(Edge 앱 모드)을 위한 로컬 서버와 실행기를 제공한다.
// 재생 페이지는 127.0.0.1 전용 서버에서 서빙되고, heartbeat/SSE로 앱 워치독과 연동된다.
package popup

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"

	"holmz/internal/domain"
)

// PlayerControl 은 팝업 서버가 필요로 하는 재생 서비스 기능이다.
type PlayerControl interface {
	ActiveList() ([]domain.PlaylistItem, error)
	Heartbeat(state string)
}

type Server struct {
	player PlayerControl
	ln     net.Listener
	base   string

	mu      sync.Mutex
	clients map[chan string]struct{}
}

// StartServer 는 127.0.0.1의 임의 포트에서 재생 페이지 서버를 시작한다.
func StartServer(player PlayerControl) (*Server, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	s := &Server{player: player, ln: ln,
		base:    "http://" + ln.Addr().String(),
		clients: map[chan string]struct{}{}}
	mux := http.NewServeMux()
	mux.HandleFunc("/player", s.handlePage)
	mux.HandleFunc("/api/playlist", s.handlePlaylist)
	mux.HandleFunc("/api/heartbeat", s.handleHeartbeat)
	mux.HandleFunc("/api/events", s.handleEvents)
	go http.Serve(ln, mux)
	return s, nil
}

func (s *Server) PlayerURL() string { return s.base + "/player" }
func (s *Server) Close()            { s.ln.Close() }

// Broadcast 는 접속 중인 재생 페이지에 명령("reload"/"stop")을 보낸다.
func (s *Server) Broadcast(cmd string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.clients {
		select {
		case ch <- cmd:
		default:
		}
	}
}

func (s *Server) handlePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(playerPage))
}

func (s *Server) handlePlaylist(w http.ResponseWriter, r *http.Request) {
	list, err := s.player.ActiveList()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		State string `json:"state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.player.Heartbeat(body.State)
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	ch := make(chan string, 4)
	s.mu.Lock()
	s.clients[ch] = struct{}{}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.clients, ch)
		s.mu.Unlock()
	}()

	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case cmd := <-ch:
			if _, err := w.Write([]byte("data: " + cmd + "\n\n")); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
