package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

type fakeTaskScheduler struct {
	registered   []string // TaskName 순서 기록
	items        []domain.ScheduleItem // Register에 전달된 항목 (payload 검증용)
	unregistered []string
	failRegister bool
}

func (f *fakeTaskScheduler) Register(s domain.ScheduleItem) error {
	if f.failRegister {
		return errFakeRegister
	}
	f.registered = append(f.registered, s.TaskName)
	f.items = append(f.items, s)
	return nil
}

func (f *fakeTaskScheduler) Unregister(taskName string) error {
	f.unregistered = append(f.unregistered, taskName)
	return nil
}

var errFakeRegister = &fakeRegErr{}

type fakeRegErr struct{}

func (e *fakeRegErr) Error() string { return "access denied" }

func setupSchedule(t *testing.T) (*ScheduleService, *fakeTaskScheduler) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	f := &fakeTaskScheduler{}
	return NewScheduleService(sqlite.NewScheduleRepo(db), f, filepath.Join(t.TempDir(), "announce")), f
}

func TestScheduleAddRegistersActive(t *testing.T) {
	svc, f := setupSchedule(t)
	item, err := svc.Add("오픈 알림", "09:00", []string{"MON"}, domain.ActionNotifyOpen, "", 1, true)
	if err != nil || item.ID == 0 {
		t.Fatalf("Add = %+v, err=%v", item, err)
	}
	if len(f.registered) != 1 || f.registered[0] != "오픈 알림" {
		t.Errorf("registered = %v", f.registered)
	}

	// 비활성 항목은 OS에 등록하지 않는다
	if _, err := svc.Add("비활성", "10:00", nil, domain.ActionUpload, "", 1, false); err != nil {
		t.Fatal(err)
	}
	if len(f.registered) != 1 {
		t.Errorf("inactive item must not be registered: %v", f.registered)
	}
}

func TestScheduleToggleAndDelete(t *testing.T) {
	svc, f := setupSchedule(t)
	item, err := svc.Add("작업", "09:00", nil, domain.ActionUpload, "", 1, true)
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.Toggle(item.ID, false); err != nil {
		t.Fatalf("Toggle off: %v", err)
	}
	if len(f.unregistered) == 0 || f.unregistered[len(f.unregistered)-1] != "작업" {
		t.Errorf("toggle off should unregister: %v", f.unregistered)
	}

	if err := svc.Toggle(item.ID, true); err != nil {
		t.Fatalf("Toggle on: %v", err)
	}
	if f.registered[len(f.registered)-1] != "작업" {
		t.Errorf("toggle on should re-register: %v", f.registered)
	}

	if err := svc.Delete(item.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	list, _ := svc.List()
	if len(list) != 0 {
		t.Errorf("List after delete = %v", list)
	}
	if f.unregistered[len(f.unregistered)-1] != "작업" {
		t.Errorf("delete should unregister: %v", f.unregistered)
	}
}

func TestPlayAudioRequiresPayload(t *testing.T) {
	svc, f := setupSchedule(t)
	if _, err := svc.Add("안내방송", "21:30", nil, domain.ActionPlayAudio, "", 1, true); err == nil {
		t.Fatal("play-audio without payload should fail")
	}
	item, err := svc.Add("안내방송", "21:30", nil, domain.ActionPlayAudio, `C:\audio\close.mp3`, 1, true)
	if err != nil || item.Payload != `C:\audio\close.mp3` {
		t.Fatalf("Add with payload = %+v, err=%v", item, err)
	}
	if len(f.registered) != 1 {
		t.Errorf("registered = %v", f.registered)
	}
}

func TestPlayAudioRepeatGeneratesPlaylist(t *testing.T) {
	svc, f := setupSchedule(t)

	// 6회 이상은 거부
	if _, err := svc.Add("과다", "21:30", nil, domain.ActionPlayAudio, `C:\audio\a.mp3`, 6, true); err == nil {
		t.Fatal("repeat > 5 should fail")
	}

	item, err := svc.Add("마감 안내 2회", "21:30", nil, domain.ActionPlayAudio, `C:\HOLMZ audio\마감 & 안내.mp3`, 2, true)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	// DB에는 원본 경로·횟수가 남는다
	if item.Payload != `C:\HOLMZ audio\마감 & 안내.mp3` || item.Repeat != 2 {
		t.Errorf("stored item = %+v", item)
	}
	// OS에는 .wpl 재생목록이 등록된다
	reg := f.items[len(f.items)-1]
	if !strings.HasSuffix(reg.Payload, ".wpl") {
		t.Fatalf("registered payload = %q, want .wpl playlist", reg.Payload)
	}
	b, err := os.ReadFile(reg.Payload)
	if err != nil {
		t.Fatalf("playlist not written: %v", err)
	}
	content := string(b)
	if n := strings.Count(content, "<media "); n != 2 {
		t.Errorf("playlist media entries = %d, want 2\n%s", n, content)
	}
	if !strings.Contains(content, `C:\HOLMZ audio\마감 &amp; 안내.mp3`) {
		t.Errorf("playlist src not XML-escaped:\n%s", content)
	}

	// 토글 재활성화 시에도 재생목록으로 재등록
	if err := svc.Toggle(item.ID, false); err != nil {
		t.Fatal(err)
	}
	if err := svc.Toggle(item.ID, true); err != nil {
		t.Fatal(err)
	}
	if reg = f.items[len(f.items)-1]; !strings.HasSuffix(reg.Payload, ".wpl") {
		t.Errorf("re-register payload = %q, want .wpl", reg.Payload)
	}

	// 삭제 시 재생목록 파일도 정리
	wpl := reg.Payload
	if err := svc.Delete(item.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(wpl); !os.IsNotExist(err) {
		t.Errorf("playlist should be removed on delete: %v", err)
	}
}

func TestPlayAudioSingleRepeatRegistersDirectPath(t *testing.T) {
	svc, f := setupSchedule(t)
	if _, err := svc.Add("안내 1회", "21:30", nil, domain.ActionPlayAudio, `C:\audio\a.mp3`, 1, true); err != nil {
		t.Fatal(err)
	}
	if reg := f.items[len(f.items)-1]; reg.Payload != `C:\audio\a.mp3` {
		t.Errorf("single repeat should register audio path directly: %q", reg.Payload)
	}
}

func TestScheduleAddRegisterFailureRollsBack(t *testing.T) {
	svc, f := setupSchedule(t)
	f.failRegister = true
	if _, err := svc.Add("실패", "09:00", nil, domain.ActionUpload, "", 1, true); err == nil {
		t.Fatal("Add should propagate register error")
	}
	list, _ := svc.List()
	if len(list) != 0 {
		t.Errorf("failed add should not persist: %v", list)
	}
}

func TestOpenCloseFor(t *testing.T) {
	svc, _ := setupSchedule(t)
	must := func(_ *domain.ScheduleItem, err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	// 매일 오픈 09:00, 월·화만 마감 22:00, 비활성 마감 23:00(무시되어야 함)
	must(svc.Add("오픈 알림", "09:00", nil, domain.ActionNotifyOpen, "", 1, true))
	must(svc.Add("마감 알림", "22:00", []string{"MON", "TUE"}, domain.ActionNotifyClose, "", 1, true))
	item, err := svc.Add("비활성 마감", "23:00", []string{"WED"}, domain.ActionNotifyClose, "", 1, true)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Toggle(item.ID, false); err != nil {
		t.Fatal(err)
	}

	open, close, err := svc.OpenCloseFor("MON")
	if err != nil || open != "09:00" || close != "22:00" {
		t.Errorf("MON = %q/%q (err=%v), want 09:00/22:00", open, close, err)
	}
	open, close, _ = svc.OpenCloseFor("WED")
	if open != "09:00" || close != "" {
		t.Errorf("WED = %q/%q, want 09:00/'' (inactive ignored)", open, close)
	}
}

func TestApplyTemplate(t *testing.T) {
	svc, f := setupSchedule(t)
	if err := svc.ApplyTemplate("09:00", "22:00"); err != nil {
		t.Fatalf("ApplyTemplate: %v", err)
	}
	list, _ := svc.List()
	if len(list) != 5 {
		t.Fatalf("template items = %d, want 5", len(list))
	}
	byAction := map[string]string{}
	for _, s := range list {
		byAction[s.ActionType] = s.RunTime
	}
	if byAction[domain.ActionNotifyOpen] != "09:00" || byAction[domain.ActionPlayStart] != "09:00" ||
		byAction[domain.ActionNotifyClose] != "22:00" || byAction[domain.ActionUpload] != "22:00" ||
		byAction[domain.ActionPlayStop] != "22:00" {
		t.Errorf("template actions/times = %v", byAction)
	}
	if len(f.registered) != 5 {
		t.Errorf("registered = %d, want 5", len(f.registered))
	}
}
