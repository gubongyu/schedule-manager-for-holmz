// Package scheduler 는 domain.TaskScheduler 의 Windows schtasks.exe 구현이다.
// 작업은 "HOLMZ\" 접두 폴더 아래에 등록된다. 등록에는 관리자 권한(UAC)이 필요할 수 있다.
package scheduler

import (
	"fmt"
	"os/exec"
	"strings"

	"holmz/internal/domain"
)

var allDays = []string{"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}

type SchtasksAdapter struct {
	exePath string
	run     func(args ...string) (string, error)
}

// New 는 어댑터를 만든다. run 이 nil이면 실제 schtasks.exe 를 실행한다.
func New(exePath string, run func(args ...string) (string, error)) *SchtasksAdapter {
	if run == nil {
		run = func(args ...string) (string, error) {
			out, err := exec.Command("schtasks.exe", args...).CombinedOutput()
			return string(out), err
		}
	}
	return &SchtasksAdapter{exePath: exePath, run: run}
}

func taskPath(name string) string { return `HOLMZ\` + name }

// Register 는 같은 이름의 기존 작업을 정리한 뒤 주간 반복 작업을 등록한다.
func (s *SchtasksAdapter) Register(item domain.ScheduleItem) error {
	_ = s.Unregister(item.TaskName)
	days := item.RepeatDays
	if len(days) == 0 {
		days = allDays
	}
	args := []string{
		"/Create", "/F",
		"/TN", taskPath(item.TaskName),
		"/TR", fmt.Sprintf(`"%s" --action=%s`, s.exePath, item.ActionType),
		"/SC", "WEEKLY",
		"/D", strings.Join(days, ","),
		"/ST", item.RunTime,
	}
	out, err := s.run(args...)
	if err != nil {
		return fmt.Errorf("작업 스케줄러 등록 실패 (관리자 권한 필요 여부 확인): %v — %s", err, strings.TrimSpace(out))
	}
	return nil
}

// Unregister 는 작업을 삭제한다. 없는 작업 삭제는 오류로 취급하지 않는다 (best-effort).
func (s *SchtasksAdapter) Unregister(taskName string) error {
	_, _ = s.run("/Delete", "/F", "/TN", taskPath(taskName))
	return nil
}
