package googledrive

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func writeCredentials(t *testing.T, dir string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, "credentials.json"), []byte(testCredentials), 0o600); err != nil {
		t.Fatal(err)
	}
}

// 인증 대기 중에도 Authorized() 등 다른 호출이 잠기지 않아야 한다 (설정 화면 멈춤 버그 회귀 테스트).
func TestAuthorizeDoesNotBlockOtherCalls(t *testing.T) {
	dir := t.TempDir()
	writeCredentials(t, dir)
	a := New(dir, func(string) error { return nil }) // 브라우저는 열리지 않음 → 타임아웃까지 대기

	old := authTimeout
	authTimeout = 300 * time.Millisecond
	t.Cleanup(func() { authTimeout = old })

	authDone := make(chan error, 1)
	go func() { authDone <- a.Authorize() }()
	time.Sleep(50 * time.Millisecond) // Authorize가 대기 상태에 들어갈 시간

	// 대기 중 Authorized() 호출이 즉시 반환되어야 한다
	checked := make(chan bool, 1)
	go func() { checked <- a.Authorized() }()
	select {
	case v := <-checked:
		if v {
			t.Error("Authorized() = true during pending auth, want false")
		}
	case <-time.After(150 * time.Millisecond):
		t.Fatal("Authorized() blocked while Authorize() is waiting — settings page would freeze")
	}

	// 대기 중 두 번째 Authorize는 즉시 '진행 중' 오류를 반환해야 한다
	secondDone := make(chan error, 1)
	go func() { secondDone <- a.Authorize() }()
	select {
	case err := <-secondDone:
		if err == nil || !strings.Contains(err.Error(), "진행 중") {
			t.Errorf("second Authorize err = %v, want busy error", err)
		}
	case <-time.After(150 * time.Millisecond):
		t.Fatal("second Authorize blocked, want immediate busy error")
	}

	// 첫 인증은 타임아웃으로 종료되고, 이후 재시도가 가능해야 한다
	select {
	case err := <-authDone:
		if err == nil || !strings.Contains(err.Error(), "시간이 초과") {
			t.Errorf("first Authorize err = %v, want timeout", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("first Authorize did not finish after timeout")
	}
	retryDone := make(chan error, 1)
	go func() { retryDone <- a.Authorize() }()
	select {
	case err := <-retryDone:
		if err == nil || strings.Contains(err.Error(), "진행 중") {
			t.Errorf("retry after timeout err = %v, want timeout (not busy)", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("retry Authorize did not finish")
	}
}
