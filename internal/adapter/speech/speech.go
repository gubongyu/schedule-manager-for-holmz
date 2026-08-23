// Package speech 는 텍스트를 즉시 음성으로 송출하는 안내 방송 어댑터다.
// Windows 내장 TTS(System.Speech, SAPI)를 PowerShell로 호출하므로 추가 설치가 필요 없다.
// (~/project/tts_program 의 설계를 이식: 한/영 자동 감지 + 배속. MeloTTS 대신
// 단일 exe 배포를 위해 OS 내장 음성을 사용한다.)
package speech

import "fmt"

// DetectLanguage 는 한글 음절 비율이 10% 이상이면 ko, 아니면 en을 반환한다.
func DetectLanguage(text string) string {
	letters, hangul := 0, 0
	for _, r := range text {
		isHangul := r >= '가' && r <= '힣'
		if isHangul || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			letters++
		}
		if isHangul {
			hangul++
		}
	}
	if letters == 0 {
		return "en"
	}
	if float64(hangul)/float64(letters) >= 0.1 {
		return "ko"
	}
	return "en"
}

// buildScript 는 stdin으로 받은 텍스트를 읽어주는 PowerShell 스크립트를 만든다.
// 텍스트는 stdin으로 전달되므로 스크립트에 사용자 입력이 섞이지 않는다(인젝션 방지).
func buildScript(lang string, rate int) string {
	if rate < -10 {
		rate = -10
	}
	if rate > 10 {
		rate = 10
	}
	return fmt.Sprintf(`Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = %d
$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like '%s*' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Speak([Console]::In.ReadToEnd())`, rate, lang)
}
