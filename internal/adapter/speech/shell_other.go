//go:build !windows

package speech

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// DefaultCommand 는 tts_program CLI(MeloTTS)를 직접 호출하는 기본 템플릿이다 (개발 환경).
const DefaultCommand = `cd ~/project/tts_program && poetry run python tts.py '{in}' --out '{out}' --speed {speed} --no-play`

func runShell(command string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	out, err := exec.CommandContext(ctx, "bash", "-lc", command).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v — %s", err, tail(string(out)))
	}
	return nil
}
