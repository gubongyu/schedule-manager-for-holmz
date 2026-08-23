//go:build !windows

package speech

import "errors"

// 비Windows(개발 환경) 스텁.
type Announcer struct{}

func NewAnnouncer() *Announcer { return &Announcer{} }

func (a *Announcer) Speak(text string, rate int) error {
	return errors.New("안내 방송은 Windows에서만 지원됩니다")
}

func (a *Announcer) Stop()          {}
func (a *Announcer) Speaking() bool { return false }
