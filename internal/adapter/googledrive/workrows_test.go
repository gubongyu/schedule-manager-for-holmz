package googledrive

import (
	"reflect"
	"testing"

	"holmz/internal/domain"
)

// 예시 스프레드시트 형식: 날짜 | 구분 | 학번 | 이름 | 순찰 시간 | 업무 내역 | 비고
// 업무 기록 항목당 1행이며 출근/퇴근도 행으로 남긴다.
func TestWorkLogRowsMatchExampleFormat(t *testing.T) {
	logs := []domain.WorkLog{{
		Date: "2026-08-02", EmployeeName: "서민용", StudentID: "20261234",
		ClockIn: "2026-08-02T09:58:00+09:00", ClockOut: "2026-08-02T14:02:00+09:00",
		TotalHrs:  4.07,
		TaskNotes: "[10:00] 순찰\n4층 게이트(C) 오류 문의(인증해도 안열림)",
	}}
	rows := workLogRows(logs)

	want := [][]any{
		{"날짜", "구분", "학번", "이름", "순찰 시간", "업무 내역", "비고"},
		{"2026. 8. 2", "학생", "20261234", "서민용", "09:58", "출근", ""},
		{"2026. 8. 2", "학생", "20261234", "서민용", "10:00", "순찰", ""},
		{"2026. 8. 2", "학생", "20261234", "서민용", "", "4층 게이트(C) 오류 문의(인증해도 안열림)", ""},
		{"2026. 8. 2", "학생", "20261234", "서민용", "14:02", "퇴근", "총 4.07시간"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("workLogRows mismatch:\n got: %v\nwant: %v", rows, want)
	}
}

func TestWorkLogRowsOpenShiftAndEmptyNotes(t *testing.T) {
	logs := []domain.WorkLog{{
		Date: "2026-12-31", EmployeeName: "김근무", StudentID: "20250001",
		ClockIn: "2026-12-31T09:00:00+09:00", // 퇴근 전 (동기화 대상은 아니지만 방어)
	}}
	rows := workLogRows(logs)
	if len(rows) != 2 { // 헤더 + 출근
		t.Fatalf("rows = %v", rows)
	}
	if rows[1][0] != "2026. 12. 31" || rows[1][4] != "09:00" || rows[1][5] != "출근" {
		t.Errorf("clock-in row = %v", rows[1])
	}
}
