package wmplaylist

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRepeatWritesPlaylist(t *testing.T) {
	dir := t.TempDir()
	w := New(dir)

	path, err := w.Repeat(7, `C:\HOLMZ audio\마감 & 안내.mp3`, 3)
	if err != nil {
		t.Fatalf("Repeat: %v", err)
	}
	if filepath.Dir(path) != dir || !strings.HasSuffix(path, ".wpl") {
		t.Errorf("경로 = %q", path)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("생성되지 않음: %v", err)
	}
	content := string(b)
	if n := strings.Count(content, "<media "); n != 3 {
		t.Errorf("항목 수 = %d, want 3\n%s", n, content)
	}
	if !strings.Contains(content, `C:\HOLMZ audio\마감 &amp; 안내.mp3`) {
		t.Errorf("XML 이스케이프 안 됨:\n%s", content)
	}
	if !strings.HasPrefix(content, "<?wpl") {
		t.Errorf("WPL 헤더 없음:\n%s", content)
	}
}

func TestRepeatRejectsInvalidCount(t *testing.T) {
	w := New(t.TempDir())
	if _, err := w.Repeat(1, "a.mp3", 1); err == nil {
		t.Error("1회는 재생목록이 필요 없으므로 거부해야 합니다")
	}
	if _, err := w.Repeat(1, "", 2); err == nil {
		t.Error("빈 경로는 거부해야 합니다")
	}
}

func TestDiscardRemovesPlaylist(t *testing.T) {
	dir := t.TempDir()
	w := New(dir)
	path, err := w.Repeat(9, "a.mp3", 2)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Discard(9); err != nil {
		t.Fatalf("Discard: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("삭제되지 않음: %v", err)
	}
	// 없는 것을 지워도 오류가 아니다
	if err := w.Discard(9); err != nil {
		t.Errorf("없는 항목 Discard = %v, want nil", err)
	}
}
