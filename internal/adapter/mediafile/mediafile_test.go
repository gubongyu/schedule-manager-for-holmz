package mediafile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTemp(t *testing.T, name, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestStoreSaveCopiesWithExtension(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(dir, PhotoMimes, 0)
	src := writeTemp(t, "원본 사진.PNG", "PNGDATA")

	dest, err := s.Save("entry_7", src)
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if want := filepath.Join(dir, "entry_7.png"); dest != want {
		t.Errorf("dest = %q, want %q", dest, want)
	}
	if b, _ := os.ReadFile(dest); string(b) != "PNGDATA" {
		t.Errorf("복사 내용 = %q", b)
	}

	// 같은 이름으로 다시 저장하면 덮어쓴다
	src2 := writeTemp(t, "다른 사진.png", "NEW")
	if _, err := s.Save("entry_7", src2); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(dest); string(b) != "NEW" {
		t.Errorf("덮어쓰기 실패: %q", b)
	}
}

func TestStoreRejectsUnsupportedType(t *testing.T) {
	s := NewStore(t.TempDir(), PhotoMimes, 0)
	src := writeTemp(t, "문서.pdf", "x")
	if _, err := s.Save("entry_1", src); err == nil || !strings.Contains(err.Error(), "형식") {
		t.Errorf("err = %v, want unsupported-type error", err)
	}
}

func TestStoreDataURLAndRemoveStayInsideDir(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(dir, PhotoMimes, 0)
	src := writeTemp(t, "a.png", "IMG")
	dest, err := s.Save("entry_1", src)
	if err != nil {
		t.Fatal(err)
	}

	url, err := s.DataURL(dest)
	if err != nil || !strings.HasPrefix(url, "data:image/png;base64,") {
		t.Fatalf("DataURL = %q, err=%v", url, err)
	}

	// 폴더 밖 파일은 읽지도 지우지도 못한다
	outside := writeTemp(t, "b.png", "OUT")
	if _, err := s.DataURL(outside); err == nil {
		t.Error("폴더 밖 파일을 읽으면 안 됩니다")
	}
	if err := s.Remove(outside); err == nil {
		t.Error("폴더 밖 파일을 지우면 안 됩니다")
	}
	if _, err := os.Stat(outside); err != nil {
		t.Errorf("폴더 밖 파일이 삭제되었습니다: %v", err)
	}

	if err := s.Remove(dest); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if _, err := os.Stat(dest); !os.IsNotExist(err) {
		t.Errorf("삭제되지 않았습니다: %v", err)
	}
	// 이미 없는 파일 삭제는 오류가 아니다
	if err := s.Remove(dest); err != nil {
		t.Errorf("없는 파일 삭제 = %v, want nil", err)
	}
}

func TestDataURLAnyPathWithLimits(t *testing.T) {
	src := writeTemp(t, "안내.wav", "RIFFDATA")
	url, err := DataURL(src, AudioMimes, 1<<20)
	if err != nil || !strings.HasPrefix(url, "data:audio/wav;base64,") {
		t.Fatalf("DataURL = %q, err=%v", url, err)
	}

	if _, err := DataURL(src, AudioMimes, 4); err == nil || !strings.Contains(err.Error(), "큽니다") {
		t.Errorf("크기 제한 err = %v", err)
	}
	if _, err := DataURL(writeTemp(t, "x.txt", "t"), AudioMimes, 0); err == nil {
		t.Error("지원하지 않는 형식은 거부해야 합니다")
	}
	if _, err := DataURL(filepath.Join(t.TempDir(), "없음.wav"), AudioMimes, 0); err == nil {
		t.Error("없는 파일은 오류여야 합니다")
	}
}
