package main

// 안내 방송(텍스트 → 음성 합성·재생·관리) 바인딩.

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"holmz/internal/adapter/mediafile"
	"holmz/internal/adapter/speech"
)

// 안내 방송 문구·음성 파일 제한.
const (
	maxAnnounceRunes = 500
	maxAudioBytes    = 30 << 20 // 30MB
)

// AnnounceResult 는 방송 준비 결과다. AudioURL 이 있으면 프론트엔드가 그 음성을 재생하고,
// 비어 있으면(Fallback) 내장 음성으로 이미 송출된 것이다.
type AnnounceResult struct {
	AudioURL string `json:"audioUrl"`
	WavPath  string `json:"wavPath"`
	Fallback bool   `json:"fallback"`
	Message  string `json:"message"`
}

// Announce 는 입력 텍스트를 tts_program(MeloTTS)으로 합성해 재생용 음성을 돌려준다.
// 같은 문구·속도는 캐시된 wav를 재사용하며, 합성이 불가능하면 내장 음성으로 대체 송출한다.
// speed: 1.0이 보통 (tts_program --speed).
func (a *App) Announce(text string, speed float64) (*AnnounceResult, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("방송할 내용을 입력하세요")
	}
	if len([]rune(text)) > maxAnnounceRunes {
		return nil, fmt.Errorf("방송 문구는 %d자 이하로 입력하세요", maxAnnounceRunes)
	}
	if speed <= 0 {
		speed = 1
	}
	if a.synth == nil {
		return nil, errors.New("TTS 합성기가 초기화되지 않았습니다")
	}

	wav, err := a.synth.WavFor(text, speed)
	if err != nil {
		log.Printf("TTS 합성 실패, 내장 음성으로 대체합니다: %v", err)
		if ferr := a.announcer.Speak(text, 0); ferr != nil {
			return nil, fmt.Errorf("%v (내장 음성도 실패: %v)", err, ferr)
		}
		return &AnnounceResult{Fallback: true, Message: err.Error()}, nil
	}
	url, err := a.AudioDataURL(wav)
	if err != nil {
		return nil, err
	}
	return &AnnounceResult{AudioURL: url, WavPath: wav}, nil
}

// ListAnnouncements 는 생성해 둔 안내 방송 목록을 최신순으로 반환한다.
func (a *App) ListAnnouncements() ([]speech.Cached, error) {
	if a.synth == nil {
		return nil, errors.New("TTS 합성기가 초기화되지 않았습니다")
	}
	return a.synth.List()
}

// DeleteAnnouncement 는 생성해 둔 안내 방송 음성을 삭제한다.
func (a *App) DeleteAnnouncement(wavPath string) error {
	if a.synth == nil {
		return errors.New("TTS 합성기가 초기화되지 않았습니다")
	}
	return a.synth.Delete(wavPath)
}

func (a *App) StopAnnounce() { a.announcer.Stop() }

func (a *App) AnnounceSpeaking() bool { return a.announcer.Speaking() }

// PickAudioFile 은 파일 대화상자로 음성 파일을 선택해 경로를 반환한다. 취소 시 빈 문자열.
func (a *App) PickAudioFile() (string, error) {
	return a.pickFile("음성 파일 선택", "오디오 (*.mp3;*.wav;*.m4a;*.ogg)", "*.mp3;*.wav;*.m4a;*.ogg")
}

// AudioDataURL 은 음성 파일을 data URL로 반환한다 (WebView <audio> 재생용).
// 스케줄용 음성은 사용자가 임의 폴더에서 고르므로 경로를 제한하지 않는다.
func (a *App) AudioDataURL(path string) (string, error) {
	return mediafile.DataURL(path, mediafile.AudioMimes, maxAudioBytes)
}

// pickFile 은 파일 선택 대화상자를 띄운다 (Wails 런타임 의존을 한곳에 모은다).
func (a *App) pickFile(title, filterName, pattern string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   title,
		Filters: []runtime.FileFilter{{DisplayName: filterName, Pattern: pattern}},
	})
}
