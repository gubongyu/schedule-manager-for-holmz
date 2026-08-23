package speech

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestToWSLPath(t *testing.T) {
	cases := map[string]string{
		`C:\Users\admin\HOLMZ\a b.wav`: "/mnt/c/Users/admin/HOLMZ/a b.wav",
		`D:\x\y.txt`:                   "/mnt/d/x/y.txt",
		"/tmp/x.wav":                   "/tmp/x.wav",
	}
	for in, want := range cases {
		if got := toWSLPath(in); got != want {
			t.Errorf("toWSLPath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestExpandPlaceholders(t *testing.T) {
	// WSL 자리표시자는 Windows 경로를 /mnt/... 로 바꿔 넣는다
	wsl := expand(`tts.py '{in_wsl}' --out '{out_wsl}' --speed {speed}`, `C:\h\in.txt`, `C:\h\out.wav`, 1.25)
	for _, want := range []string{"/mnt/c/h/in.txt", "/mnt/c/h/out.wav", "--speed 1.25"} {
		if !strings.Contains(wsl, want) {
			t.Errorf("expanded command missing %q:\n%s", want, wsl)
		}
	}
	// OS별 기본 템플릿은 자리표시자가 모두 채워져야 한다
	got := expand(DefaultCommand, `C:\h\in.txt`, `C:\h\out.wav`, 1.25)
	if strings.Contains(got, "{") {
		t.Errorf("unexpanded placeholder remains: %s", got)
	}
	if !strings.Contains(got, "tts.py") {
		t.Errorf("default command should call tts.py: %s", got)
	}
	// 네이티브 경로 자리표시자도 지원한다
	native := expand("say {in} -o {out} rate={speed}", "/a/in.txt", "/a/out.wav", 1)
	if native != "say /a/in.txt -o /a/out.wav rate=1.00" {
		t.Errorf("native expand = %q", native)
	}
}

func TestWavForSynthesizesThenCaches(t *testing.T) {
	dir := t.TempDir()
	calls := 0
	s := NewSynthesizer(dir, func() string { return "fake {out}" })
	s.run = func(command string) error {
		calls++
		// 실제 TTS처럼 out 경로에 파일을 만든다
		out := strings.TrimPrefix(command, "fake ")
		return os.WriteFile(out, []byte("RIFFfake"), 0o644)
	}

	wav, err := s.WavFor("4층 열람실 마감 안내", 1)
	if err != nil || calls != 1 {
		t.Fatalf("WavFor = %q, err=%v, calls=%d", wav, err, calls)
	}
	if filepath.Dir(wav) != dir || !strings.HasSuffix(wav, ".wav") {
		t.Errorf("wav path = %q", wav)
	}

	// 같은 문구·속도는 재합성하지 않는다
	again, err := s.WavFor("4층 열람실 마감 안내", 1)
	if err != nil || again != wav || calls != 1 {
		t.Errorf("cache miss: again=%q calls=%d err=%v", again, calls, err)
	}
	// 속도가 다르면 새로 합성한다
	if _, err := s.WavFor("4층 열람실 마감 안내", 1.2); err != nil || calls != 2 {
		t.Errorf("speed change should resynthesize: calls=%d err=%v", calls, err)
	}
}

func TestWavForReportsFailure(t *testing.T) {
	s := NewSynthesizer(t.TempDir(), func() string { return "" })
	s.run = func(string) error { return errors.New("boom") }
	if _, err := s.WavFor("안내", 1); err == nil || !strings.Contains(err.Error(), "TTS 명령") {
		t.Errorf("err = %v, want guidance about TTS command", err)
	}

	// 명령은 성공했지만 wav가 없으면 오류
	s.run = func(string) error { return nil }
	if _, err := s.WavFor("안내2", 1); err == nil || !strings.Contains(err.Error(), "생성되지 않았") {
		t.Errorf("err = %v, want missing-file error", err)
	}
}

// 실제 tts_program(MeloTTS)으로 합성되는지 확인한다. 모델 로딩이 느려 기본 스킵.
// 실행: HOLMZ_TTS_IT=1 go test ./internal/adapter/speech/ -run Integration -v
func TestWavForIntegration(t *testing.T) {
	if os.Getenv("HOLMZ_TTS_IT") != "1" {
		t.Skip("HOLMZ_TTS_IT=1 일 때만 실행")
	}
	s := NewSynthesizer(t.TempDir(), func() string { return "" }) // 기본 명령 사용
	wav, err := s.WavFor("홈즈에서 안내드립니다. 잠시 후 마감입니다.", 1)
	if err != nil {
		t.Fatalf("WavFor: %v", err)
	}
	info, err := os.Stat(wav)
	if err != nil || info.Size() < 10000 {
		t.Fatalf("생성된 wav가 비정상입니다: %v (size=%v)", err, info)
	}
	t.Logf("생성됨: %s (%d bytes)", wav, info.Size())
}
