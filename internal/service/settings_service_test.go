package service

import (
	"path/filepath"
	"reflect"
	"testing"

	"holmz/internal/repository/sqlite"
)

func setupSettings(t *testing.T) *SettingsService {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewSettingsService(sqlite.NewSettingsRepo(db))
}

func TestTaskOptionsDefaultsAndRoundTrip(t *testing.T) {
	svc := setupSettings(t)

	got, err := svc.TaskOptions()
	if err != nil || len(got) == 0 {
		t.Fatalf("기본 업무 항목 = %v, err=%v", got, err)
	}
	if got[0] != "청소" {
		t.Errorf("기본값 첫 항목 = %q", got[0])
	}

	if err := svc.SetTaskOptions([]string{"순찰", "  자료 정리  ", "", "소등"}); err != nil {
		t.Fatal(err)
	}
	got, _ = svc.TaskOptions()
	want := []string{"순찰", "자료 정리", "소등"} // 공백 정리 + 빈 줄 제거
	if !reflect.DeepEqual(got, want) {
		t.Errorf("TaskOptions = %v, want %v", got, want)
	}

	// 전부 지우면 기본값으로 돌아간다
	if err := svc.SetTaskOptions(nil); err != nil {
		t.Fatal(err)
	}
	if got, _ = svc.TaskOptions(); got[0] != "청소" {
		t.Errorf("비운 뒤 = %v, want 기본값", got)
	}
}

func TestNoticeRoundTrip(t *testing.T) {
	svc := setupSettings(t)
	if v, err := svc.Notice(); err != nil || v != "" {
		t.Fatalf("초기 공지 = %q, err=%v", v, err)
	}
	if err := svc.SetNotice("오늘 13시 청소"); err != nil {
		t.Fatal(err)
	}
	if v, _ := svc.Notice(); v != "오늘 13시 청소" {
		t.Errorf("Notice = %q", v)
	}
}

func TestTTSCommandFallsBackToDefault(t *testing.T) {
	svc := setupSettings(t)
	if v, err := svc.TTSCommand("기본명령"); err != nil || v != "기본명령" {
		t.Fatalf("미설정 시 = %q, err=%v", v, err)
	}
	if err := svc.SetTTSCommand("  내명령  "); err != nil {
		t.Fatal(err)
	}
	if v, _ := svc.TTSCommand("기본명령"); v != "내명령" {
		t.Errorf("TTSCommand = %q, want 공백 정리된 사용자 명령", v)
	}
	// 빈 값으로 저장하면 다시 기본값
	if err := svc.SetTTSCommand("   "); err != nil {
		t.Fatal(err)
	}
	if v, _ := svc.TTSCommand("기본명령"); v != "기본명령" {
		t.Errorf("비운 뒤 = %q, want 기본값", v)
	}
}

// 설정한 적이 없으면 모든 항목이 켜져 있고, 저장한 값은 그대로 돌아와야 한다.
func TestSyncTargetsDefaultAndRoundTrip(t *testing.T) {
	svc := setupSettings(t)
	got, err := svc.SyncTargets()
	if err != nil {
		t.Fatal(err)
	}
	if got != AllSyncTargets() {
		t.Errorf("기본값 %+v, want 전부 켜짐", got)
	}
	want := SyncTargets{Worklog: false, Master: true, Desk: true}
	if err := svc.SetSyncTargets(want); err != nil {
		t.Fatal(err)
	}
	if got, err = svc.SyncTargets(); err != nil || got != want {
		t.Errorf("SyncTargets=%+v (err=%v), want %+v", got, err, want)
	}
}

// 기능 설정은 기본이 모두 켜짐이고, 저장한 값이 그대로 돌아와야 한다.
func TestFeaturesDefaultAndRoundTrip(t *testing.T) {
	svc := setupSettings(t)
	got, err := svc.Features()
	if err != nil {
		t.Fatal(err)
	}
	if got != AllFeatures() {
		t.Errorf("기본값 %+v, want 전부 켜짐", got)
	}
	want := Features{Dashboard: false, Rental: true, LostFound: false, LostReported: false, SubRequest: true}
	if err := svc.SetFeatures(want); err != nil {
		t.Fatal(err)
	}
	if got, err = svc.Features(); err != nil || got != want {
		t.Errorf("Features=%+v (err=%v), want %+v", got, err, want)
	}
}

// 대여·분실물 기능을 모두 끄면 해당 Drive 동기화도 함께 멈춰야 한다.
func TestDeskSyncFollowsFeatures(t *testing.T) {
	svc := setupSettings(t)
	if err := svc.SetFeatures(Features{Dashboard: true}); err != nil {
		t.Fatal(err)
	}
	tg, err := svc.SyncTargets()
	if err != nil {
		t.Fatal(err)
	}
	if tg.Desk {
		t.Error("데스크 기능을 모두 껐는데 동기화가 켜져 있다")
	}
	if err := svc.SetFeatures(Features{LostFound: true}); err != nil {
		t.Fatal(err)
	}
	if tg, err = svc.SyncTargets(); err != nil || !tg.Desk {
		t.Errorf("분실물 습득만 켜도 동기화는 켜져야 한다 (Desk=%v, err=%v)", tg.Desk, err)
	}
}
