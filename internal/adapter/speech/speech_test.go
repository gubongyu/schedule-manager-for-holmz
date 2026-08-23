package speech

import (
	"strings"
	"testing"
)

// tts_program의 language.py를 이식: 한글 음절 비율 10% 이상이면 ko.
func TestDetectLanguage(t *testing.T) {
	cases := map[string]string{
		"4층 열람실을 정리해주세요":               "ko",
		"Library closes in 30 minutes": "en",
		"The 열람실 will close soon":      "ko", // 혼합 — 한글 비율 충분
		"OK":                           "en",
		"1234!?":                       "en", // 문자 없음 → en
	}
	for text, want := range cases {
		if got := DetectLanguage(text); got != want {
			t.Errorf("DetectLanguage(%q) = %s, want %s", text, got, want)
		}
	}
}

func TestBuildScript(t *testing.T) {
	s := buildScript("ko", 2)
	for _, want := range []string{"System.Speech", "'ko*'", "$s.Rate = 2", "ReadToEnd"} {
		if !strings.Contains(s, want) {
			t.Errorf("script missing %q:\n%s", want, s)
		}
	}
	if got := buildScript("en", -11); !strings.Contains(got, "$s.Rate = -10") {
		t.Errorf("rate should clamp to -10: %s", got)
	}
	if got := buildScript("en", 99); !strings.Contains(got, "$s.Rate = 10") {
		t.Errorf("rate should clamp to 10: %s", got)
	}
	if !strings.Contains(buildScript("en", 0), "'en*'") {
		t.Error("en culture hint missing")
	}
}
