package domain

// Shift 는 직원의 주간 반복 근무 배치다 (근로 스케줄).
// 자동화용 ScheduleItem(작업 스케줄러)과 구분된다.
type Shift struct {
	ID           int64  `json:"id"`
	EmployeeID   int64  `json:"employeeId"`
	EmployeeName string `json:"employeeName"`
	Weekday      string `json:"weekday"` // MON..SUN
	Start        string `json:"start"`   // HH:MM
	End          string `json:"end"`     // HH:MM
}
