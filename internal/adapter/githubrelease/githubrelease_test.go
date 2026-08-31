package githubrelease

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func newTestSource(t *testing.T, handler http.HandlerFunc) *Source {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	s := New("someone", "holmz")
	s.baseURL = srv.URL
	return s
}

const sampleRelease = `{
  "tag_name": "v1.3.0",
  "body": "음량 조절 추가",
  "html_url": "https://github.com/someone/holmz/releases/tag/v1.3.0",
  "assets": [
    {"name": "README.txt", "browser_download_url": "https://x/readme", "size": 10},
    {"name": "holmz.exe", "browser_download_url": "https://x/holmz.exe", "size": 24045056}
  ]
}`

func TestLatestParsesReleaseAndPicksExeAsset(t *testing.T) {
	var gotPath string
	s := newTestSource(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Write([]byte(sampleRelease))
	})

	rel, err := s.Latest()
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/repos/someone/holmz/releases/latest" {
		t.Errorf("요청 경로 = %s", gotPath)
	}
	if rel.Version != "v1.3.0" || rel.Notes != "음량 조절 추가" {
		t.Errorf("릴리스 = %+v", rel)
	}
	if rel.DownloadURL != "https://x/holmz.exe" || rel.Size != 24045056 {
		t.Errorf("실행 파일 자산을 골라야 한다: %+v", rel)
	}
	if rel.PageURL != "https://github.com/someone/holmz/releases/tag/v1.3.0" {
		t.Errorf("릴리스 페이지 주소 = %q", rel.PageURL)
	}
}

// 릴리스가 아직 없거나 저장소가 비공개면 404가 온다. 알릴 것이 없을 뿐 오류는 아니다.
func TestLatestReturnsNothingOn404(t *testing.T) {
	s := newTestSource(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Not Found", http.StatusNotFound)
	})
	rel, err := s.Latest()
	if err != nil || rel != nil {
		t.Errorf("404 → %+v, %v; want nil, nil", rel, err)
	}
}

func TestLatestFailsOnServerError(t *testing.T) {
	s := newTestSource(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	if _, err := s.Latest(); err == nil {
		t.Error("500 응답은 오류여야 한다")
	}
}

// 실행 파일 자산이 없는 릴리스는 URL 없이 돌려준다 (서비스가 걸러낸다).
func TestLatestWithoutExeAsset(t *testing.T) {
	s := newTestSource(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"tag_name":"v1.3.0","assets":[]}`))
	})
	rel, err := s.Latest()
	if err != nil || rel == nil || rel.DownloadURL != "" {
		t.Errorf("자산 없는 릴리스 = %+v, %v", rel, err)
	}
}

// 릴리스에 holmz.exe.sha256 자산이 있으면 그 내용을 읽어 체크섬으로 쓴다.
func TestLatestReadsChecksumAsset(t *testing.T) {
	var s *Source
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sum" {
			w.Write([]byte("abc123  holmz.exe\n"))
			return
		}
		w.Write([]byte(`{"tag_name":"v1.3.0","assets":[
			{"name":"holmz.exe","browser_download_url":"https://x/holmz.exe","size":10},
			{"name":"holmz.exe.sha256","browser_download_url":"` + s.baseURL + `/sum","size":70}]}`))
	}))
	t.Cleanup(srv.Close)
	s = New("someone", "holmz")
	s.baseURL = srv.URL

	rel, err := s.Latest()
	if err != nil {
		t.Fatal(err)
	}
	if rel.SHA256 != "abc123" {
		t.Errorf("체크섬 = %q, want abc123 (파일명 부분은 버려야 한다)", rel.SHA256)
	}
}

// 체크섬 자산을 못 읽어도 릴리스 조회 자체는 성공해야 한다 (검증만 생략).
func TestLatestSurvivesChecksumFailure(t *testing.T) {
	s := newTestSource(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"tag_name":"v1.3.0","assets":[
			{"name":"holmz.exe","browser_download_url":"https://x/holmz.exe","size":10},
			{"name":"holmz.exe.sha256","browser_download_url":"http://127.0.0.1:1/none","size":70}]}`))
	})
	rel, err := s.Latest()
	if err != nil || rel == nil || rel.SHA256 != "" {
		t.Errorf("체크섬 조회 실패 = %+v, %v; want 릴리스는 정상", rel, err)
	}
}

func TestDownloadWritesFile(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("실행 파일 내용"))
	}))
	t.Cleanup(srv.Close)

	dst := filepath.Join(t.TempDir(), "holmz.exe.new")
	if err := New("a", "b").Download(srv.URL, dst); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(dst)
	if err != nil || string(got) != "실행 파일 내용" {
		t.Errorf("내려받은 파일 = %q, %v", got, err)
	}
}

func TestDownloadFailsOnHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	dst := filepath.Join(t.TempDir(), "holmz.exe.new")
	if err := New("a", "b").Download(srv.URL, dst); err == nil {
		t.Error("404 다운로드는 오류여야 한다")
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		t.Error("실패하면 파일을 남기지 않아야 한다")
	}
}

// 빈 체크섬 자산에도 죽지 않아야 한다.
func TestLatestHandlesEmptyChecksumAsset(t *testing.T) {
	var s *Source
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sum" {
			w.Write([]byte("   \n"))
			return
		}
		w.Write([]byte(`{"tag_name":"v1.3.0","assets":[
			{"name":"holmz.exe","browser_download_url":"https://x/holmz.exe","size":10},
			{"name":"holmz.exe.sha256","browser_download_url":"` + s.baseURL + `/sum","size":1}]}`))
	}))
	t.Cleanup(srv.Close)
	s = New("someone", "holmz")
	s.baseURL = srv.URL

	rel, err := s.Latest()
	if err != nil || rel == nil || rel.SHA256 != "" {
		t.Errorf("빈 체크섬 = %+v, %v", rel, err)
	}
}
