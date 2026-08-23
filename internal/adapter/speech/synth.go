package speech

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Synthesizer 는 외부 TTS 프로그램(tts_program, MeloTTS)을 호출해 안내 문구를 wav로 만든다.
// 합성은 수십 초가 걸리므로 같은 문구·속도는 캐시된 wav를 재사용한다.
type Synthesizer struct {
	cacheDir string
	// template 은 실행할 명령 템플릿을 반환한다 (설정 변경이 즉시 반영되도록 함수로 받는다).
	template func() string
	run      func(command string) error // 테스트 주입용
}

func NewSynthesizer(cacheDir string, template func() string) *Synthesizer {
	return &Synthesizer{cacheDir: cacheDir, template: template, run: runShell}
}

// toWSLPath 는 Windows 경로를 WSL 경로로 바꾼다 (C:\a\b → /mnt/c/a/b).
// 이미 UNIX 경로면 그대로 둔다.
func toWSLPath(p string) string {
	if len(p) >= 2 && p[1] == ':' {
		drive := strings.ToLower(p[:1])
		rest := strings.ReplaceAll(p[2:], `\`, "/")
		return "/mnt/" + drive + rest
	}
	return strings.ReplaceAll(p, `\`, "/")
}

// appDir 은 실행 파일이 있는 폴더다 ({app} 자리표시자). 번들된 TTS를 exe 옆에서 찾는다.
func appDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

// expand 는 명령 템플릿의 자리표시자를 채운다.
func expand(template, in, out string, speed float64) string {
	r := strings.NewReplacer(
		"{in_wsl}", toWSLPath(in),
		"{out_wsl}", toWSLPath(out),
		"{in}", in,
		"{out}", out,
		"{app}", appDir(),
		"{speed}", fmt.Sprintf("%.2f", speed),
	)
	return r.Replace(template)
}

// WavFor 는 문구의 wav 경로를 반환한다. 캐시에 없으면 TTS 명령으로 새로 합성한다.
func (s *Synthesizer) WavFor(text string, speed float64) (string, error) {
	cmdTemplate := strings.TrimSpace(s.template())
	if cmdTemplate == "" {
		cmdTemplate = DefaultCommand
	}
	if err := os.MkdirAll(s.cacheDir, 0o755); err != nil {
		return "", err
	}

	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%.2f|%s", text, speed, cmdTemplate)))
	base := filepath.Join(s.cacheDir, "tts_"+hex.EncodeToString(sum[:])[:16])
	wav, txt := base+".wav", base+".txt"

	if info, err := os.Stat(wav); err == nil && info.Size() > 0 {
		return wav, nil // 캐시 재사용
	}
	if err := os.WriteFile(txt, []byte(text), 0o644); err != nil {
		return "", err
	}
	if err := s.run(expand(cmdTemplate, txt, wav, speed)); err != nil {
		return "", fmt.Errorf("음성 생성 실패 (설정의 TTS 명령을 확인하세요): %w", err)
	}
	info, err := os.Stat(wav)
	if err != nil || info.Size() == 0 {
		return "", fmt.Errorf("음성 파일이 생성되지 않았습니다: %s", wav)
	}
	return wav, nil
}

// tail 은 오류 메시지에 붙일 출력 꼬리를 잘라낸다.
func tail(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 300 {
		return "..." + s[len(s)-300:]
	}
	return s
}
