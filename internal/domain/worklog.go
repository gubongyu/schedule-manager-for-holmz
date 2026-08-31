package domain

import (
	"math"
	"time"
)

// WorkLog 은 근무자 1명의 하루 근무 기록이다. 시각은 RFC3339 문자열로 저장한다.
type WorkLog struct {
	ID           int64   `json:"id"`
	EmployeeID   int64   `json:"employeeId"`
	EmployeeName string  `json:"employeeName"`
	StudentID    string  `json:"studentId"` // 직원 학번 (조회 시 employees에서 조인)
	Date         string  `json:"date"`      // YYYY-MM-DD
	ClockIn      string  `json:"clockIn"`
	ClockOut     string  `json:"clockOut"` // 근무 중이면 빈 문자열
	TaskNotes    string  `json:"taskNotes"`
	SyncStatus   string  `json:"syncStatus"` // pending | synced
	TotalHrs     float64 `json:"totalHours"`
}

// TotalHours 는 출퇴근 시각 차이를 시간 단위(소수 둘째 자리 반올림)로 반환한다.
func (w WorkLog) TotalHours() float64 {
	if w.ClockIn == "" || w.ClockOut == "" {
		return 0
	}
	in, err1 := time.Parse(time.RFC3339, w.ClockIn)
	out, err2 := time.Parse(time.RFC3339, w.ClockOut)
	if err1 != nil || err2 != nil || out.Before(in) {
		return 0
	}
	return math.Round(out.Sub(in).Hours()*100) / 100
}
