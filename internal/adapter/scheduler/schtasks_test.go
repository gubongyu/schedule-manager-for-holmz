package scheduler

import (
	"strings"
	"testing"

	"holmz/internal/domain"
)

type call struct{ args []string }

func fakeRunner(calls *[]call) func(...string) (string, error) {
	return func(args ...string) (string, error) {
		*calls = append(*calls, call{args: args})
		return "", nil
	}
}

func TestRegisterBuildsSchtasksArgs(t *testing.T) {
	var calls []call
	a := New(`C:\holmz\holmz.exe`, fakeRunner(&calls))

	item := domain.ScheduleItem{TaskName: "오픈 알림", RunTime: "09:00",
		RepeatDays: []string{"MON", "TUE", "WED"}, ActionType: domain.ActionNotifyOpen, Active: true}
	if err := a.Register(item); err != nil {
		t.Fatalf("Register: %v", err)
	}
	// 첫 호출은 기존 작업 정리(/Delete), 두 번째가 /Create
	if len(calls) != 2 {
		t.Fatalf("calls = %d, want 2 (delete + create)", len(calls))
	}
	created := strings.Join(calls[1].args, " ")
	for _, want := range []string{
		"/Create", "/F",
		`/TN HOLMZ\오픈 알림`,
		`/TR "C:\holmz\holmz.exe" --action=notify-open`,
		"/SC WEEKLY", "/D MON,TUE,WED", "/ST 09:00",
	} {
		if !strings.Contains(created, want) {
			t.Errorf("create args missing %q in: %s", want, created)
		}
	}
}

func TestRegisterPlayAudioUsesMediaPlayer(t *testing.T) {
	var calls []call
	a := New(`C:\holmz\holmz.exe`, fakeRunner(&calls))
	item := domain.ScheduleItem{TaskName: "안내방송", RunTime: "21:30",
		ActionType: domain.ActionPlayAudio, Payload: `C:\HOLMZ 방송\마감 안내.mp3`, Active: true}
	if err := a.Register(item); err != nil {
		t.Fatal(err)
	}
	created := strings.Join(calls[1].args, " ")
	// 음성 재생은 앱이 아니라 Windows Media Player가 직접 실행한다 (앱이 꺼져 있어도 동작).
	want := `/TR "C:\Program Files\Windows Media Player\wmplayer.exe" /play /close "C:\HOLMZ 방송\마감 안내.mp3"`
	if !strings.Contains(created, want) {
		t.Errorf("create args should launch wmplayer:\n got: %s\nwant: %s", created, want)
	}
	if strings.Contains(created, "holmz.exe") {
		t.Errorf("play-audio task must not launch the app: %s", created)
	}
}

func TestRegisterDefaultsToDaily(t *testing.T) {
	var calls []call
	a := New(`C:\x.exe`, fakeRunner(&calls))
	if err := a.Register(domain.ScheduleItem{TaskName: "T", RunTime: "10:00", ActionType: domain.ActionUpload}); err != nil {
		t.Fatal(err)
	}
	created := strings.Join(calls[1].args, " ")
	if !strings.Contains(created, "/D MON,TUE,WED,THU,FRI,SAT,SUN") {
		t.Errorf("empty RepeatDays should default to every day: %s", created)
	}
}

func TestUnregisterIsBestEffort(t *testing.T) {
	a := New(`C:\x.exe`, func(args ...string) (string, error) {
		return "ERROR: task not found", errFake
	})
	if err := a.Unregister("없는작업"); err != nil {
		t.Errorf("Unregister should ignore errors, got %v", err)
	}
}

var errFake = &fakeErr{}

type fakeErr struct{}

func (e *fakeErr) Error() string { return "exit 1" }
