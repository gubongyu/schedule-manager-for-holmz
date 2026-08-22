package domain

// Employee 는 근무자다. 학번이 본인 확인(PIN 역할)에 사용된다.
type Employee struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	StudentID  string `json:"studentId"`  // 학번 — 본인 확인용
	Department string `json:"department"` // 학과
	Active     bool   `json:"active"`     // soft-delete 용 (UI에는 노출하지 않음)
}
