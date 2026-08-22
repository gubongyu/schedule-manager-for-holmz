package popup

import (
	"strings"
	"testing"
)

func TestEdgeArgs(t *testing.T) {
	args := edgeArgs("http://127.0.0.1:9999/player", `C:\cfg\edge-player`)
	joined := strings.Join(args, " ")
	for _, want := range []string{
		"--app=http://127.0.0.1:9999/player",
		`--user-data-dir=C:\cfg\edge-player`, // 전용 프로필 → 독립 프로세스 보장 (종료·감지 가능)
		"--autoplay-policy=no-user-gesture-required",
		"--no-first-run",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("edgeArgs missing %q in %s", want, joined)
		}
	}
}
