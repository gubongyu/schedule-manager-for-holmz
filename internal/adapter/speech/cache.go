package speech

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Cached 는 이미 생성해 둔 안내 방송 음성 1건이다.
type Cached struct {
	Text      string `json:"text"`
	WavPath   string `json:"wavPath"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"` // RFC3339
}

const cachePrefix = "tts_"

// isCacheWav 는 캐시 폴더 안의 TTS 결과물인지 확인한다 (스케줄용 .wpl 등은 제외).
func (s *Synthesizer) isCacheWav(path string) bool {
	clean := filepath.Clean(path)
	if filepath.Dir(clean) != filepath.Clean(s.cacheDir) {
		return false
	}
	base := filepath.Base(clean)
	return strings.HasPrefix(base, cachePrefix) && strings.HasSuffix(base, ".wav")
}

// List 는 생성해 둔 안내 방송 목록을 최신순으로 반환한다.
func (s *Synthesizer) List() ([]Cached, error) {
	entries, err := os.ReadDir(s.cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Cached{}, nil // 아직 만든 방송이 없다
		}
		return nil, err
	}
	out := []Cached{}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.HasPrefix(name, cachePrefix) || !strings.HasSuffix(name, ".wav") {
			continue
		}
		wav := filepath.Join(s.cacheDir, name)
		info, err := e.Info()
		if err != nil {
			continue
		}
		text, _ := os.ReadFile(strings.TrimSuffix(wav, ".wav") + ".txt")
		out = append(out, Cached{
			Text:      strings.TrimSpace(string(text)),
			WavPath:   wav,
			Size:      info.Size(),
			CreatedAt: info.ModTime().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	return out, nil
}

// Delete 는 생성해 둔 안내 방송(wav와 원문 txt)을 지운다.
// 캐시 폴더 안의 TTS 결과물만 지울 수 있다.
func (s *Synthesizer) Delete(wavPath string) error {
	if !s.isCacheWav(wavPath) {
		return fmt.Errorf("삭제할 수 없는 경로입니다: %s", wavPath)
	}
	clean := filepath.Clean(wavPath)
	if err := os.Remove(clean); err != nil {
		return err
	}
	_ = os.Remove(strings.TrimSuffix(clean, ".wav") + ".txt")
	return nil
}
