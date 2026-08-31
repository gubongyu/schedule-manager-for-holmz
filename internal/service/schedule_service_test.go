package service

import (
	"fmt"
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

type fakeTaskScheduler struct {
	registered   []string              // TaskName 순서 기록
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

// fakeRepeater 는 연속 재생 준비를 흉내 낸다 (실제 파일은 만들지 않는다).
type fakeRepeater struct {
	calls     []string // "id|path|count"
	discarded []int64
}

func (f *fakeRepeater) Repeat(id int64, audioPath string, count int) (string, error) {
	f.calls = append(f.calls, fmt.Sprintf("%d|%s|%d", id, audioPath, count))
	return fmt.Sprintf("playlist_%d.wpl", id), nil
}

func (f *fakeRepeater) Discard(id int64) error {
	f.discarded = append(f.discarded, id)
	return nil
}

func setupSchedule(t *testing.T) (*ScheduleService, *fakeTaskScheduler) {
	svc, os, _ := setupScheduleWithRepeater(t)
	return svc, os
}

func setupScheduleWithRepeater(t *testing.T) (*ScheduleService, *fakeTaskScheduler, *fakeRepeater) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	f := &fakeTaskScheduler{}
	r := &fakeRepeater{}
	return NewScheduleService(sqlite.NewScheduleRepo(db), f, r), f, r
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

func TestPlayAudioRepeatUsesRepeater(t *testing.T) {
	svc, f, rep := setupScheduleWithRepeater(t)

	// 6회 이상은 거부
	if _, err := svc.Add("과다", "21:30", nil, domain.ActionPlayAudio, `C:\audio\a.mp3`, 6, true); err == nil {
		t.Fatal("repeat > 5 should fail")
	}

	item, err := svc.Add("마감 안내 2회", "21:30", nil, domain.ActionPlayAudio, `C:\HOLMZ audio\마감 안내.mp3`, 2, true)
	if err != nil {
		t.Fatalf("Add: %v", err)
	}
	// DB에는 원본 경로·횟수가 남는다
	if item.Payload != `C:\HOLMZ audio\마감 안내.mp3` || item.Repeat != 2 {
		t.Errorf("stored item = %+v", item)
	}
	// 연속 재생 준비가 원본 경로·횟수로 요청된다
	want := fmt.Sprintf("%d|%s|2", item.ID, `C:\HOLMZ audio\마감 안내.mp3`)
	if len(rep.calls) != 1 || rep.calls[0] != want {
		t.Fatalf("repeater 호출 = %v, want %q", rep.calls, want)
	}
	// OS에는 준비된 재생 대상이 등록된다
	if reg := f.items[len(f.items)-1]; reg.Payload != fmt.Sprintf("playlist_%d.wpl", item.ID) {
		t.Errorf("등록된 payload = %q", reg.Payload)
	}

	// 토글 재활성화 시에도 다시 준비한다
	if err := svc.Toggle(item.ID, false); err != nil {
		t.Fatal(err)
	}
	if err := svc.Toggle(item.ID, true); err != nil {
		t.Fatal(err)
	}
	if len(rep.calls) != 2 {
		t.Errorf("재활성화 시 준비 호출 = %d, want 2", len(rep.calls))
	}

	// 삭제 시 준비물도 정리한다
	if err := svc.Delete(item.ID); err != nil {
		t.Fatal(err)
	}
	if len(rep.discarded) == 0 || rep.discarded[len(rep.discarded)-1] != item.ID {
		t.Errorf("정리 호출 = %v, want %d 포함", rep.discarded, item.ID)
	}
}

func TestPlayAudioSingleRepeatRegistersDirectPath(t *testing.T) {
	svc, f, rep := setupScheduleWithRepeater(t)
	if _, err := svc.Add("안내 1회", "21:30", nil, domain.ActionPlayAudio, `C:\audio\a.mp3`, 1, true); err != nil {
		t.Fatal(err)
	}
	if reg := f.items[len(f.items)-1]; reg.Payload != `C:\audio\a.mp3` {
		t.Errorf("single repeat should register audio path directly: %q", reg.Payload)
	}
	if len(rep.calls) != 0 {
		t.Errorf("1회 재생은 준비가 필요 없습니다: %v", rep.calls)
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
