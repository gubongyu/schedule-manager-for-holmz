//go:build windows

package speech

import (
	"os/exec"
	"strings"
	"sync"
	"syscall"
)

// Announcer 는 한 번에 하나의 안내 방송을 재생한다. 새 방송은 이전 방송을 중단한다.
type Announcer struct {
	mu  sync.Mutex
	cmd *exec.Cmd
}

func NewAnnouncer() *Announcer { return &Announcer{} }

// Speak 은 텍스트를 즉시 음성으로 송출한다 (비동기, 언어 자동 감지).
func (a *Announcer) Speak(text string, rate int) error {
	a.Stop()
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
		buildScript(DetectLanguage(text), rate))
	cmd.Stdin = strings.NewReader(text)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	a.mu.Lock()
	a.cmd = cmd
	a.mu.Unlock()
	go func() {
		_ = cmd.Wait()
		a.mu.Lock()
		if a.cmd == cmd {
			a.cmd = nil
		}
		a.mu.Unlock()
	}()
	return nil
}

// Stop 은 재생 중인 방송을 중단한다.
func (a *Announcer) Stop() {
	a.mu.Lock()
	cmd := a.cmd
	a.cmd = nil
	a.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
}

// Speaking 은 방송 재생 중 여부다.
func (a *Announcer) Speaking() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cmd != nil
}
