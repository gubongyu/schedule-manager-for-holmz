// Package mediafile 은 사진·음성 같은 미디어 파일의 보관과 WebView 표시용 data URL 변환을 담당한다.
// 파일 시스템 접근을 이 어댑터에 모아, 파사드·서비스 계층이 경로와 인코딩을 다루지 않게 한다.
package mediafile

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// 지원 형식과 MIME 타입.
var (
	PhotoMimes = map[string]string{
		".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
	}
	AudioMimes = map[string]string{
		".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
	}
)

// Store 는 지정한 폴더 안에서만 미디어를 보관·조회하는 저장소다.
// 폴더 밖 경로는 읽기·삭제 모두 거부해 임의 파일 접근을 막는다.
type Store struct {
	dir     string
	mimes   map[string]string
	maxSize int64 // 0이면 제한 없음
}

func NewStore(dir string, mimes map[string]string, maxSize int64) *Store {
	return &Store{dir: dir, mimes: mimes, maxSize: maxSize}
}

// Dir 은 저장소 폴더 경로다.
func (s *Store) Dir() string { return s.dir }

// contains 는 경로가 저장소 폴더 바로 아래인지 확인한다.
func (s *Store) contains(path string) bool {
	return filepath.Dir(filepath.Clean(path)) == filepath.Clean(s.dir)
}

// Save 는 원본 파일을 저장소로 복사하고 저장된 경로를 반환한다.
// baseName 은 확장자를 뺀 이름이며, 확장자는 원본을 따른다 (같은 이름이면 덮어쓴다).
func (s *Store) Save(baseName, srcPath string) (string, error) {
	ext := strings.ToLower(filepath.Ext(srcPath))
	if _, ok := s.mimes[ext]; !ok {
		return "", fmt.Errorf("지원하지 않는 파일 형식입니다: %s", ext)
	}
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return "", err
	}
	src, err := os.Open(srcPath)
	if err != nil {
		return "", err
	}
	defer src.Close()

	dest := filepath.Join(s.dir, baseName+ext)
	dst, err := os.Create(dest)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return "", err
	}
	if err := dst.Close(); err != nil {
		return "", err
	}
	return dest, nil
}

// Remove 는 저장소 안의 파일을 지운다. 이미 없으면 성공으로 본다.
func (s *Store) Remove(path string) error {
	if !s.contains(path) {
		return fmt.Errorf("저장소 밖의 파일은 삭제할 수 없습니다: %s", path)
	}
	if err := os.Remove(filepath.Clean(path)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DataURL 은 저장소 안의 파일을 data URL로 반환한다.
func (s *Store) DataURL(path string) (string, error) {
	if !s.contains(path) {
		return "", fmt.Errorf("저장소 밖의 파일은 열 수 없습니다: %s", path)
	}
	return DataURL(path, s.mimes, s.maxSize)
}

// DataURL 은 파일을 data URL 문자열로 변환한다 (사용자가 직접 고른 임의 경로용).
// maxSize 가 0보다 크면 그 크기를 넘는 파일은 거부한다.
func DataURL(path string, mimes map[string]string, maxSize int64) (string, error) {
	mime, ok := mimes[strings.ToLower(filepath.Ext(path))]
	if !ok {
		return "", fmt.Errorf("지원하지 않는 파일 형식입니다: %s", filepath.Ext(path))
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("파일을 열 수 없습니다: %w", err)
	}
	if maxSize > 0 && info.Size() > maxSize {
		return "", fmt.Errorf("파일이 너무 큽니다 (%dMB 이하)", maxSize>>20)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}
