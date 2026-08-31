package domain

import "time"

// Employee 는 근무자다. 학번이 본인 확인(PIN 역할)에 사용된다.
type Employee struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	StudentID  string `json:"studentId"`  // 학번 — 본인 확인용
	Department string `json:"department"` // 학과
	StartDate  string `json:"startDate"`  // 근무 시작일 (YYYY-MM-DD)
	EndDate    string `json:"endDate"`    // 근로 종료일 — 저장하지 않고 시작일에서 계산한다
	Active     bool   `json:"active"`     // soft-delete 용 (UI에는 노출하지 않음)
}

// 근로 장학생의 근무 기간(개월).
const WorkMonths = 11

// WorkEndDate 는 근무 시작일로부터 WorkMonths 개월 뒤인 근로 종료일을 YYYY-MM-DD 로 반환한다.
// 시작일이 없거나 형식이 잘못되면 빈 문자열이다.
// 도착한 달에 같은 날짜가 없으면(예: 3/31 → 2월) 그 달의 마지막 날로 맞춘다.
func (e Employee) WorkEndDate() string {
	t, err := time.Parse("2006-01-02", e.StartDate)
	if err != nil {
		return ""
	}
	day := t.Day()
	firstOfTarget := time.Date(t.Year(), t.Month()+WorkMonths, 1, 0, 0, 0, 0, t.Location())
	lastDay := firstOfTarget.AddDate(0, 1, -1).Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(firstOfTarget.Year(), firstOfTarget.Month(), day, 0, 0, 0, 0, t.Location()).
		Format("2006-01-02")
}
