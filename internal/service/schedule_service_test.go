package service

import (
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

type fakeTaskScheduler struct {
	registered   []string // TaskName 순서 기록
	unregistered []string
	failRegister bool
}

func (f *fakeTaskScheduler) Register(s domain.ScheduleItem) error {
	if f.failRegister {
		return errFakeRegister
	}
	f.registered = append(f.registered, s.TaskName)
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
	return NewScheduleService(sqlite.NewScheduleRepo(db), f), f
}

func TestScheduleAddRegistersActive(t *testing.T) {
	svc, f := setupSchedule(t)
	item, err := svc.Add("오픈 알림", "09:00", []string{"MON"}, domain.ActionNotifyOpen, "", true)
	if err != nil || item.ID == 0 {
		t.Fatalf("Add = %+v, err=%v", item, err)
	}
	if len(f.registered) != 1 || f.registered[0] != "오픈 알림" {
		t.Errorf("registered = %v", f.registered)
	}

	// 비활성 항목은 OS에 등록하지 않는다
	if _, err := svc.Add("비활성", "10:00", nil, domain.ActionUpload, "", false); err != nil {
		t.Fatal(err)
	}
	if len(f.registered) != 1 {
		t.Errorf("inactive item must not be registered: %v", f.registered)
	}
}

func TestScheduleToggleAndDelete(t *testing.T) {
	svc, f := setupSchedule(t)
	item, err := svc.Add("작업", "09:00", nil, domain.ActionUpload, "", true)
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
	if _, err := svc.Add("안내방송", "21:30", nil, domain.ActionPlayAudio, "", true); err == nil {
		t.Fatal("play-audio without payload should fail")
	}
	item, err := svc.Add("안내방송", "21:30", nil, domain.ActionPlayAudio, `C:\audio\close.mp3`, true)
	if err != nil || item.Payload != `C:\audio\close.mp3` {
		t.Fatalf("Add with payload = %+v, err=%v", item, err)
	}
	if len(f.registered) != 1 {
		t.Errorf("registered = %v", f.registered)
	}
}

func TestScheduleAddRegisterFailureRollsBack(t *testing.T) {
	svc, f := setupSchedule(t)
	f.failRegister = true
	if _, err := svc.Add("실패", "09:00", nil, domain.ActionUpload, "", true); err == nil {
		t.Fatal("Add should propagate register error")
	}
	list, _ := svc.List()
	if len(list) != 0 {
		t.Errorf("failed add should not persist: %v", list)
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
