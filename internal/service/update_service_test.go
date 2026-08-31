package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"holmz/internal/domain"
)

type fakeReleases struct {
	rel   *domain.Release
	err   error
	calls int

	payload []byte // Download 가 기록할 내용
	dlErr   error
	dlURL   string
}

func (f *fakeReleases) Latest() (*domain.Release, error) {
	f.calls++
	return f.rel, f.err
}

func (f *fakeReleases) Download(url, dst string) error {
	f.dlURL = url
	if f.dlErr != nil {
		return f.dlErr
	}
	return os.WriteFile(dst, f.payload, 0o755)
}

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"v1.0.0", "v1.0.1", -1},
		{"v1.10.0", "v1.9.0", 1},
		{"1.2", "v1.2.0", 0},
		{"v2.0.0", "v1.9.9", 1},
		{"v1.2.3", "v1.2.3", 0},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestUpdateCheckFindsNewerVersion(t *testing.T) {
	src := &fakeReleases{rel: &domain.Release{
		Version: "v1.3.0", Notes: "음량 조절 추가", DownloadURL: "https://x/holmz.exe",
		PageURL: "https://github.com/someone/holmz/releases/tag/v1.3.0", Size: 100}}
	svc := NewUpdateService(src, "v1.2.0")

	got, err := svc.Check()
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Version != "v1.3.0" || got.Notes != "음량 조절 추가" {
		t.Fatalf("Check = %+v, want v1.3.0 정보", got)
	}
	if got.PageURL != "https://github.com/someone/holmz/releases/tag/v1.3.0" {
		t.Errorf("릴리스 페이지 주소 = %q", got.PageURL)
	}
}

func TestUpdateCheckIgnoresSameOrOlder(t *testing.T) {
	for _, latest := range []string{"v1.2.0", "v1.1.9"} {
		src := &fakeReleases{rel: &domain.Release{Version: latest, DownloadURL: "u"}}
		got, err := svc(t, src, "v1.2.0").Check()
		if err != nil || got != nil {
			t.Errorf("최신=%s 일 때 Check = %+v, %v; want nil, nil", latest, got, err)
		}
	}
}

// 개발 빌드(-ldflags 로 버전을 주입하지 않은 경우)는 비교 기준이 없으므로 조회조차 하지 않는다.
func TestUpdateCheckSkipsDevBuild(t *testing.T) {
	src := &fakeReleases{rel: &domain.Release{Version: "v9.9.9", DownloadURL: "u"}}
	got, err := svc(t, src, "dev").Check()
	if err != nil || got != nil {
		t.Errorf("dev 빌드 Check = %+v, %v; want nil, nil", got, err)
	}
	if src.calls != 0 {
		t.Errorf("dev 빌드는 릴리스를 조회하지 않아야 한다 (calls=%d)", src.calls)
	}
}

// 자산이 없는 릴리스는 알릴 수 없다 (받을 파일이 없으므로).
func TestUpdateCheckIgnoresReleaseWithoutAsset(t *testing.T) {
	src := &fakeReleases{rel: &domain.Release{Version: "v9.9.9"}}
	got, err := svc(t, src, "v1.0.0").Check()
	if err != nil || got != nil {
		t.Errorf("자산 없는 릴리스 Check = %+v, %v; want nil, nil", got, err)
	}
}

func TestUpdateCheckPropagatesError(t *testing.T) {
	src := &fakeReleases{err: errors.New("네트워크 오류")}
	if _, err := svc(t, src, "v1.0.0").Check(); err == nil {
		t.Error("조회 실패는 에러로 전달되어야 한다")
	}
}

func svc(t *testing.T, src domain.ReleaseSource, current string) *UpdateService {
	t.Helper()
	return NewUpdateService(src, current)
}

// --- 설치 (다운로드 → 교체 → 재시작) ---

// setupInstall 은 임시 디렉터리에 가짜 실행 파일을 두고, 새 버전을 배포 중인 서비스를 만든다.
func setupInstall(t *testing.T, newExe []byte, sum string) (*UpdateService, string, *fakeReleases) {
	t.Helper()
	dir := t.TempDir()
	exe := filepath.Join(dir, "holmz.exe")
	if err := os.WriteFile(exe, []byte("옛 버전"), 0o755); err != nil {
		t.Fatal(err)
	}
	src := &fakeReleases{
		rel: &domain.Release{Version: "v2.0.0", DownloadURL: "https://x/holmz.exe",
			SHA256: sum, Size: int64(len(newExe))},
		payload: newExe,
	}
	svc := NewUpdateService(src, "v1.0.0")
	svc.exePath = func() (string, error) { return exe, nil }
	return svc, exe, src
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

func TestInstallReplacesExeAndRelaunches(t *testing.T) {
	payload := []byte("새 버전 실행 파일")
	svc, exe, src := setupInstall(t, payload, sha256Hex(payload))

	launched, quit := "", false
	svc.launch = func(p string) error { launched = p; return nil }
	svc.SetQuit(func() { quit = true })

	if err := svc.Install(); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(exe); string(got) != string(payload) {
		t.Errorf("실행 파일이 교체되지 않았다: %q", got)
	}
	// 실행 중인 파일은 지울 수 없으므로 이름만 바꿔 남겨둔다.
	if got, err := os.ReadFile(exe + ".old"); err != nil || string(got) != "옛 버전" {
		t.Errorf(".old 백업 = %q, %v", got, err)
	}
	if _, err := os.Stat(exe + ".new"); !os.IsNotExist(err) {
		t.Error(".new 임시 파일이 남아 있으면 안 된다")
	}
	if launched != exe || !quit {
		t.Errorf("재시작 = %q, 종료=%v", launched, quit)
	}
	if src.dlURL != "https://x/holmz.exe" {
		t.Errorf("다운로드 주소 = %q", src.dlURL)
	}
}

// 체크섬이 맞지 않으면 손대지 않고 중단해야 한다.
func TestInstallRejectsBadChecksum(t *testing.T) {
	svc, exe, _ := setupInstall(t, []byte("변조된 파일"), sha256Hex([]byte("원본")))
	launched := false
	svc.launch = func(string) error { launched = true; return nil }

	if err := svc.Install(); err == nil {
		t.Fatal("체크섬 불일치는 오류여야 한다")
	}
	if got, _ := os.ReadFile(exe); string(got) != "옛 버전" {
		t.Errorf("실패 시 실행 파일은 그대로여야 한다: %q", got)
	}
	for _, suffix := range []string{".new", ".old"} {
		if _, err := os.Stat(exe + suffix); !os.IsNotExist(err) {
			t.Errorf("실패 시 %s 가 남으면 안 된다", suffix)
		}
	}
	if launched {
		t.Error("실패했는데 재시작하면 안 된다")
	}
}

// 체크섬 자산이 없는 릴리스도 설치는 된다 (크기만 확인).
func TestInstallWithoutChecksum(t *testing.T) {
	payload := []byte("새 버전")
	svc, exe, _ := setupInstall(t, payload, "")
	svc.launch = func(string) error { return nil }

	if err := svc.Install(); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(exe); string(got) != string(payload) {
		t.Errorf("실행 파일 = %q", got)
	}
}

func TestInstallRejectsEmptyDownload(t *testing.T) {
	svc, exe, _ := setupInstall(t, nil, "")
	svc.launch = func(string) error { return nil }

	if err := svc.Install(); err == nil {
		t.Fatal("빈 파일은 오류여야 한다")
	}
	if got, _ := os.ReadFile(exe); string(got) != "옛 버전" {
		t.Errorf("실행 파일이 훼손되었다: %q", got)
	}
}

func TestInstallFailsWhenNoNewVersion(t *testing.T) {
	svc, _, src := setupInstall(t, []byte("x"), "")
	src.rel.Version = "v1.0.0" // 현재와 같음
	if err := svc.Install(); err == nil {
		t.Error("새 버전이 없으면 오류여야 한다")
	}
}

func TestCleanupOldRemovesLeftover(t *testing.T) {
	svc, exe, _ := setupInstall(t, nil, "")
	if err := os.WriteFile(exe+".old", []byte("이전"), 0o755); err != nil {
		t.Fatal(err)
	}
	svc.CleanupOld()
	if _, err := os.Stat(exe + ".old"); !os.IsNotExist(err) {
		t.Error(".old 가 지워져야 한다")
	}
}

// 교체 후 새로 실행된 프로세스는 이전 프로세스가 끝날 때까지 기다린다
// (Windows 싱글 인스턴스 잠금이 풀려야 창이 뜬다).
func TestWaitForPredecessor(t *testing.T) {
	svc, exe, _ := setupInstall(t, nil, "")
	if err := os.WriteFile(exe+".old", []byte("이전"), 0o755); err != nil {
		t.Fatal(err)
	}
	svc.waitForPredecessor(exe+".old", 2*time.Second)
	if _, err := os.Stat(exe + ".old"); !os.IsNotExist(err) {
		t.Error("이전 프로세스 종료를 확인하면 .old 가 지워진다")
	}
}
