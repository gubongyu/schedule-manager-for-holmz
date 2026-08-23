package googledrive

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"holmz/internal/domain"
)

// 예시 스프레드시트와 동일한 근로기록 형식:
// 날짜 | 구분 | 학번 | 이름 | 순찰 시간 | 업무 내역 | 비고
// 출근·업무 항목·퇴근을 각각 1행으로 기록한다.

var noteTimeRe = regexp.MustCompile(`^\[(\d{2}:\d{2})\]\s*(.*)$`)

// sheetDate 는 "2026-08-02" → "2026. 8. 2" (예시 시트의 날짜 표기).
func sheetDate(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return date
	}
	return fmt.Sprintf("%d. %d. %d", t.Year(), int(t.Month()), t.Day())
}

// clockHM 은 RFC3339 시각 → "HH:MM". 비어 있으면 빈 문자열.
func clockHM(rfc3339 string) string {
	t, err := time.Parse(time.RFC3339, rfc3339)
	if err != nil {
		return ""
	}
	return t.Format("15:04")
}

func workLogRows(logs []domain.WorkLog) [][]any {
	rows := [][]any{{"날짜", "구분", "학번", "이름", "순찰 시간", "업무 내역", "비고"}}
	for _, w := range logs {
		date := sheetDate(w.Date)
		row := func(timeHM, task, note string) []any {
			return []any{date, "학생", w.StudentID, w.EmployeeName, timeHM, task, note}
		}
		if w.ClockIn != "" {
			rows = append(rows, row(clockHM(w.ClockIn), "출근", ""))
		}
		for _, line := range strings.Split(w.TaskNotes, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			timeHM := ""
			if m := noteTimeRe.FindStringSubmatch(line); m != nil {
				timeHM, line = m[1], m[2]
			}
			rows = append(rows, row(timeHM, line, ""))
		}
		if w.ClockOut != "" {
			rows = append(rows, row(clockHM(w.ClockOut), "퇴근", fmt.Sprintf("총 %v시간", w.TotalHrs)))
		}
	}
	return rows
}
