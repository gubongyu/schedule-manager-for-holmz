package googledrive

import (
	"sort"
	"time"

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
	rows := [][]any{{"학과", "이름", "학번", "근로 종료일"}}
	for _, e := range employees {
		rows = append(rows, []any{e.Department, e.Name, e.StudentID, e.WorkEndDate()})
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

// overrideRows 는 휴가·추가 근무를 기록한다. 대타는 전용 시트(substitutionRows)로 따로 나간다.
func overrideRows(overrides []domain.ShiftOverride) [][]any {
	rows := [][]any{{"날짜", "이름", "유형", "시간", "메모"}}
	for _, o := range overrides {
		if o.Type == domain.OverrideSub {
			continue
		}
		span := ""
		if o.Start != "" {
			span = o.Start + "–" + o.End
		}
		rows = append(rows, []any{sheetDate(o.Date), o.EmployeeName, overrideTypeKR[o.Type], span, o.Note})
	}
	return rows
}

// substitutionRows 는 대타 근무를 날짜순으로 기록한다: 날짜 / 요일 / 시간 / 기존학생 / 대타학생.
func substitutionRows(overrides []domain.ShiftOverride) [][]any {
	var subs []domain.ShiftOverride
	for _, o := range overrides {
		if o.Type == domain.OverrideSub {
			subs = append(subs, o)
		}
	}
	sort.SliceStable(subs, func(i, j int) bool {
		if subs[i].Date != subs[j].Date {
			return subs[i].Date < subs[j].Date
		}
		return subs[i].Start < subs[j].Start
	})

	rows := [][]any{{"날짜", "요일", "시간", "기존학생", "대타학생"}}
	for _, o := range subs {
		rows = append(rows, []any{
			sheetDate(o.Date), weekdayOfDate(o.Date), o.Start + "–" + o.End, o.EmployeeName, o.CoverName,
		})
	}
	return rows
}

// weekdayOfDate 는 YYYY-MM-DD 날짜의 한글 요일을 반환한다.
func weekdayOfDate(date string) string {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return ""
	}
	return [...]string{"일", "월", "화", "수", "목", "금", "토"}[int(t.Weekday())]
}
