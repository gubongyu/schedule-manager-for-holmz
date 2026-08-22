package popup

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
)

var edgeCandidates = []string{
	`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
	`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
}

func edgePath() (string, error) {
	for _, p := range edgeCandidates {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	if p, err := exec.LookPath("msedge.exe"); err == nil {
		return p, nil
	}
	return "", fmt.Errorf("Microsoft Edge를 찾을 수 없습니다")
}

// edgeArgs 는 Edge 앱 모드 실행 인자를 만든다. 전용 user-data-dir 로 별도 브라우저
// 프로세스를 강제해 종료·생존 감지가 가능하게 하고, 자동재생 제한을 해제한다.
func edgeArgs(url, dataDir string) []string {
	return []string{
		"--app=" + url,
		"--user-data-dir=" + dataDir,
		"--no-first-run",
		"--no-default-browser-check",
		"--autoplay-policy=no-user-gesture-required",
		"--window-size=1280,720",
	}
}

type procHandle struct {
	cmd  *exec.Cmd
	done chan struct{}
}

// Launcher 는 재생 팝업(Edge 앱 모드 창) 프로세스를 관리한다.
type Launcher struct {
	dataDir string
	mu      sync.Mutex
	proc    *procHandle
}

func NewLauncher(dataDir string) *Launcher { return &Launcher{dataDir: dataDir} }

// Launch 는 기존 창을 정리하고 재생 팝업을 새로 띄운다.
func (l *Launcher) Launch(url string) error {
	l.Kill()
	path, err := edgePath()
	if err != nil {
		return err
	}
	cmd := exec.Command(path, edgeArgs(url, l.dataDir)...)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("재생 창 실행 실패: %w", err)
	}
	h := &procHandle{cmd: cmd, done: make(chan struct{})}
	go func() {
		_ = cmd.Wait()
		close(h.done)
	}()
	l.mu.Lock()
	l.proc = h
	l.mu.Unlock()
	return nil
}

func (l *Launcher) Kill() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.proc != nil && l.proc.cmd.Process != nil {
		_ = l.proc.cmd.Process.Kill()
	}
	l.proc = nil
}

// Running 은 재생 팝업 프로세스가 살아 있는지 알려준다.
func (l *Launcher) Running() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.proc == nil {
		return false
	}
	select {
	case <-l.proc.done:
		return false
	default:
		return true
	}
}
