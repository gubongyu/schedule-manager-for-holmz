package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"holmz/internal/domain"
)

// DevVersion 은 -ldflags 로 버전을 주입하지 않은 개발 빌드의 버전값이다.
const DevVersion = "dev"

// AwaitExitFlag 는 교체 직후 새로 실행되는 프로세스에 붙이는 플래그다.
// 이 플래그로 실행된 프로세스는 이전 프로세스가 끝날 때까지 기다린 뒤 창을 띄운다.
const AwaitExitFlag = "-await-exit"

// awaitExitTimeout 은 이전 프로세스 종료를 기다리는 한도다. 넘으면 그냥 진행한다.
const awaitExitTimeout = 30 * time.Second

// UpdateService 는 새 버전 확인과 설치(다운로드 → 실행 파일 교체 → 재시작)를 담당한다.
type UpdateService struct {
	source  domain.ReleaseSource
	current string

	// 아래 셋은 테스트에서 대체할 수 있도록 필드로 둔다.
	exePath func() (string, error)
	launch  func(path string) error
	quit    func()
}

func NewUpdateService(source domain.ReleaseSource, current string) *UpdateService {
	return &UpdateService{
		source: source, current: current,
		exePath: os.Executable,
		launch:  launchDetached,
	}
}

// SetQuit 은 교체 후 현재 앱을 종료하는 함수를 등록한다 (Wails runtime.Quit).
func (s *UpdateService) SetQuit(f func()) { s.quit = f }

// launchDetached 는 교체된 실행 파일을 새 프로세스로 띄운다.
func launchDetached(path string) error {
	cmd := exec.Command(path, AwaitExitFlag)
	cmd.Dir = filepath.Dir(path)
	return cmd.Start()
}

// Available 은 사용자에게 알릴 새 버전 정보다.
type Available struct {
	Version string `json:"version"`
	Notes   string `json:"notes"`
	URL     string `json:"url"`     // 실행 파일 주소
	PageURL string `json:"pageUrl"` // 릴리스 페이지 주소
	SHA256  string `json:"-"`       // 무결성 검증용 (프론트에 노출할 필요 없음)
}

// CurrentVersion 은 실행 중인 빌드의 버전이다.
func (s *UpdateService) CurrentVersion() string { return s.current }

// Check 는 최신 릴리스가 현재 버전보다 높으면 그 정보를 반환한다.
// 새 버전이 없으면 (nil, nil)이다. 개발 빌드는 비교 기준이 없어 조회하지 않는다.
func (s *UpdateService) Check() (*Available, error) {
	if isDevBuild(s.current) {
		return nil, nil
	}
	rel, err := s.source.Latest()
	if err != nil {
		return nil, err
	}
	// 내려받을 실행 파일이 없는 릴리스는 알려도 할 수 있는 일이 없다.
	if rel == nil || rel.DownloadURL == "" {
		return nil, nil
	}
	if compareVersions(rel.Version, s.current) <= 0 {
		return nil, nil
	}
	return &Available{Version: rel.Version, Notes: rel.Notes,
		URL: rel.DownloadURL, PageURL: rel.PageURL, SHA256: rel.SHA256}, nil
}

func isDevBuild(v string) bool {
	v = strings.TrimSpace(v)
	return v == "" || v == DevVersion
}

// compareVersions 는 "v1.2.3" 형태의 버전을 마디별 숫자로 비교한다.
// a가 크면 1, 같으면 0, 작으면 -1. 빠진 마디는 0으로 본다 ("1.2" == "1.2.0").
func compareVersions(a, b string) int {
	pa, pb := versionParts(a), versionParts(b)
	for i := 0; i < len(pa) || i < len(pb); i++ {
		var x, y int
		if i < len(pa) {
			x = pa[i]
		}
		if i < len(pb) {
			y = pb[i]
		}
		if x != y {
			if x > y {
				return 1
			}
			return -1
		}
	}
	return 0
}

// versionParts 는 버전 문자열을 숫자 마디로 쪼갠다. 숫자가 아닌 꼬리표(-beta 등)는 버린다.
func versionParts(v string) []int {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	var out []int
	for _, part := range strings.Split(v, ".") {
		digits := part
		for i, r := range part {
			if r < '0' || r > '9' {
				digits = part[:i]
				break
			}
		}
		n, _ := strconv.Atoi(digits)
		out = append(out, n)
	}
	return out
}

// --- 설치 ---

// Install 은 새 버전을 내려받아 실행 파일을 교체하고 프로그램을 다시 시작한다.
//
// Windows에서는 실행 중인 파일을 지울 수는 없지만 이름은 바꿀 수 있다는 점을 이용한다:
// 현재 파일을 .old 로 옮기고 그 자리에 새 파일을 놓는다. 중간에 실패하면 되돌린다.
func (s *UpdateService) Install() error {
	av, err := s.Check()
	if err != nil {
		return err
	}
	if av == nil {
		return fmt.Errorf("설치할 새 버전이 없습니다")
	}

	exe, err := s.exePath()
	if err != nil {
		return fmt.Errorf("실행 파일 위치를 찾을 수 없습니다: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	newPath, oldPath := exe+".new", exe+".old"

	os.Remove(newPath)
	if err := s.source.Download(av.URL, newPath); err != nil {
		os.Remove(newPath)
		return fmt.Errorf("새 버전을 내려받지 못했습니다: %w", err)
	}
	if err := verifyDownload(newPath, av.SHA256); err != nil {
		os.Remove(newPath)
		return err
	}

	os.Remove(oldPath)
	if err := os.Rename(exe, oldPath); err != nil {
		os.Remove(newPath)
		return fmt.Errorf("현재 실행 파일을 옮길 수 없습니다 (폴더 쓰기 권한을 확인하세요): %w", err)
	}
	if err := os.Rename(newPath, exe); err != nil {
		os.Rename(oldPath, exe) // 원래대로 되돌린다
		os.Remove(newPath)
		return fmt.Errorf("새 버전을 제자리에 놓지 못했습니다: %w", err)
	}

	if err := s.launch(exe); err != nil {
		return fmt.Errorf("교체는 끝났지만 실행에 실패했습니다. 프로그램을 다시 시작해주세요: %w", err)
	}
	if s.quit != nil {
		s.quit()
	}
	return nil
}

// verifyDownload 는 내려받은 파일이 쓸 만한지 확인한다.
// 배포처가 체크섬을 제공하지 않으면(want 가 빈 문자열) 크기만 본다.
func verifyDownload(path, want string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("내려받은 파일을 읽을 수 없습니다: %w", err)
	}
	if info.Size() == 0 {
		return fmt.Errorf("내려받은 파일이 비어 있습니다")
	}
	if want == "" {
		return nil
	}
	got, err := fileSHA256(path)
	if err != nil {
		return err
	}
	if !strings.EqualFold(got, want) {
		return fmt.Errorf("내려받은 파일이 손상되었습니다 (체크섬 불일치)")
	}
	return nil
}

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// CleanupOld 는 이전 업데이트가 남긴 .old 파일을 지운다 (있으면 지우고, 없으면 그만).
func (s *UpdateService) CleanupOld() {
	exe, err := s.exePath()
	if err != nil {
		return
	}
	os.Remove(exe + ".old")
}

// WaitForPredecessor 는 교체 직후 새로 실행된 프로세스가 이전 프로세스의 종료를 기다린다.
// 실행 중인 파일은 삭제할 수 없으므로, .old 삭제가 성공하면 이전 프로세스가 끝난 것이다.
// 이 대기가 없으면 싱글 인스턴스 잠금에 걸려 새 프로세스가 그대로 죽는다.
func (s *UpdateService) WaitForPredecessor() {
	exe, err := s.exePath()
	if err != nil {
		return
	}
	s.waitForPredecessor(exe+".old", awaitExitTimeout)
}

func (s *UpdateService) waitForPredecessor(oldPath string, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	for {
		if err := os.Remove(oldPath); err == nil || os.IsNotExist(err) {
			return
		}
		if time.Now().After(deadline) {
			return
		}
		time.Sleep(300 * time.Millisecond)
	}
}
