//go:build windows

package speech

import (
	"context"
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

// DefaultCommand 는 실행 파일 옆에 동봉한 TTS 프로그램(MeloTTS, PyInstaller 번들)을 호출한다.
// 대상 PC에 Python이나 WSL이 없어도 동작한다.
const DefaultCommand = `"{app}\tts\tts.exe" "{in}" --out "{out}" --speed {speed} --no-play`

// runShell 은 명령을 창 없이 실행한다. 모델 로딩 때문에 넉넉한 제한시간을 둔다.
func runShell(command string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, "cmd.exe")
	// /s /c "..." 는 바깥 따옴표만 벗기고 나머지를 그대로 넘기므로, 명령 안의
	// 따옴표·&& 가 cmd 규칙에 의해 변형되지 않는다.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CmdLine: `cmd.exe /s /c "` + command + `"`}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v — %s", err, tail(string(out)))
	}
	return nil
}
