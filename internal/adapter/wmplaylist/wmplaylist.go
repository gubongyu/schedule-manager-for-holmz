// Package wmplaylist 는 안내 음성을 연속 재생하기 위한 Windows Media Player 재생목록(.wpl)을 만든다.
// domain.AudioRepeater 구현체이며, 재생목록 파일 형식과 저장 위치를 이 어댑터가 책임진다.
package wmplaylist

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var xmlEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")

// Writer 는 지정 폴더에 재생목록을 만든다.
type Writer struct{ dir string }

func New(dir string) *Writer { return &Writer{dir: dir} }

func (w *Writer) path(id int64) string {
	return filepath.Join(w.dir, fmt.Sprintf("schedule_%d.wpl", id))
}

// Repeat 는 음성 파일을 count 회 나열한 재생목록을 만들고 경로를 반환한다.
func (w *Writer) Repeat(id int64, audioPath string, count int) (string, error) {
	if audioPath == "" {
		return "", fmt.Errorf("재생할 음성 파일이 없습니다")
	}
	if count < 2 {
		return "", fmt.Errorf("연속 재생은 2회 이상일 때만 재생목록이 필요합니다 (요청: %d)", count)
	}
	if err := os.MkdirAll(w.dir, 0o755); err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString("<?wpl version=\"1.0\"?>\n<smil>\n  <head><title>HOLMZ 안내방송</title></head>\n  <body><seq>\n")
	src := xmlEscaper.Replace(audioPath)
	for i := 0; i < count; i++ {
		fmt.Fprintf(&b, "    <media src=\"%s\"/>\n", src)
	}
	b.WriteString("  </seq></body>\n</smil>\n")

	path := w.path(id)
	return path, os.WriteFile(path, []byte(b.String()), 0o644)
}

// Discard 는 만들어 둔 재생목록을 지운다.
func (w *Writer) Discard(id int64) error {
	if err := os.Remove(w.path(id)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
