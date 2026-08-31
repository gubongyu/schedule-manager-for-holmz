package frontend

import (
	"io/fs"
	"strings"
	"testing"
)

// 프론트엔드 자산이 바이너리에 포함되는지 확인한다.
// 모듈 파일이 빠지면 앱이 백지 화면으로 뜨므로 빌드 단계에서 잡아야 한다.
func TestAssetsEmbedded(t *testing.T) {
	required := []string{
		"dist/index.html",
		"dist/style.css",
		"dist/js/main.js",
		"dist/js/api.js",
		"dist/js/ui.js",
		"dist/js/session.js",
		"dist/js/router.js",
		"dist/js/views/dashboard.js",
		"dist/js/views/worklog.js",
		"dist/js/views/announce.js",
	}
	for _, p := range required {
		if _, err := fs.Stat(Assets, p); err != nil {
			t.Errorf("자산 누락: %s (%v)", p, err)
		}
	}
}

// index.html 이 실제 진입 모듈을 가리키는지 확인한다.
func TestIndexLoadsEntryModule(t *testing.T) {
	b, err := fs.ReadFile(Assets, "dist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	html := string(b)
	if !strings.Contains(html, `type="module"`) || !strings.Contains(html, "/js/main.js") {
		t.Errorf("index.html 이 진입 모듈을 로드하지 않습니다")
	}
	if strings.Contains(html, `src="/app.js"`) {
		t.Errorf("제거된 app.js 를 아직 참조합니다")
	}
}

// 모든 뷰 모듈이 등록되어 있는지 (파일만 있고 라우터에 없으면 죽은 화면이 된다).
func TestAllViewModulesRegistered(t *testing.T) {
	main, err := fs.ReadFile(Assets, "dist/js/main.js")
	if err != nil {
		t.Fatal(err)
	}
	entries, err := fs.ReadDir(Assets, "dist/js/views")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if !strings.Contains(string(main), "views/"+e.Name()) {
			t.Errorf("main.js 가 %s 를 불러오지 않습니다", e.Name())
		}
	}
}
