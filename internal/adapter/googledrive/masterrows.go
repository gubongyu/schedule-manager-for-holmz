package googledrive

import (
	"sort"

	"holmz/internal/domain"
)

// 기준정보 스프레드시트("HOLMZ_직원·근무스케줄")의 시트별 행 생성.

var weekdayKR = map[string]string{
	"MON": "월", "TUE": "화", "WED": "수", "THU": "목", "FRI": "금", "SAT": "토", "SUN": "일",
}

var weekdayOrder = map[string]int{
	"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6,
}

func employeeRows(employees []domain.Employee) [][]any {
	rows := [][]any{{"이름", "학번", "학과", "상태"}}
	for _, e := range employees {
		status := "재직"
		if !e.Active {
			status = "비활성"
		}
		rows = append(rows, []any{e.Name, e.StudentID, e.Department, status})
	}
	return rows
}

func shiftRows(shifts []domain.Shift) [][]any {
	sorted := make([]domain.Shift, len(shifts))
	copy(sorted, shifts)
	sort.SliceStable(sorted, func(i, j int) bool {
		if weekdayOrder[sorted[i].Weekday] != weekdayOrder[sorted[j].Weekday] {
			return weekdayOrder[sorted[i].Weekday] < weekdayOrder[sorted[j].Weekday]
		}
		return sorted[i].Start < sorted[j].Start
	})
	rows := [][]any{{"요일", "이름", "시작", "종료"}}
	for _, s := range sorted {
		rows = append(rows, []any{weekdayKR[s.Weekday], s.EmployeeName, s.Start, s.End})
	}
	return rows
}

var overrideTypeKR = map[string]string{
	domain.OverrideOff:  "휴가",
	domain.OverrideWork: "추가 근무",
	domain.OverrideSub:  "대타",
}

func overrideRows(overrides []domain.ShiftOverride) [][]any {
	rows := [][]any{{"날짜", "이름", "유형", "시간", "대체 근무자", "메모"}}
	for _, o := range overrides {
		span := ""
		if o.Start != "" {
			span = o.Start + "–" + o.End
		}
		rows = append(rows, []any{sheetDate(o.Date), o.EmployeeName, overrideTypeKR[o.Type], span, o.CoverName, o.Note})
	}
	return rows
}
