package domain

// 근무 예외 유형.
const (
	OverrideOff  = "off"  // 휴가·결근 예정: 해당 날짜의 주간 배치 무효
	OverrideWork = "work" // 대타·추가 근무: 해당 날짜에 임시 배치 추가
)

// ShiftOverride 는 특정 날짜의 근무 예외(휴가/대타)다. 주간 배치보다 우선한다.
type ShiftOverride struct {
	ID           int64  `json:"id"`
	Date         string `json:"date"` // YYYY-MM-DD
	EmployeeID   int64  `json:"employeeId"`
	EmployeeName string `json:"employeeName"`
	Type         string `json:"type"`  // off | work
	Start        string `json:"start"` // work일 때만 사용
	End          string `json:"end"`
	Note         string `json:"note"`
}

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
