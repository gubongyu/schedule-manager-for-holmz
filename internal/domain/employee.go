package domain

type Employee struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	PIN    string `json:"-"` // bcrypt 해시. 프론트엔드로 직렬화하지 않는다.
	Active bool   `json:"active"`
	HasPIN bool   `json:"hasPin"` // 화면 표시용. 저장되지 않고 App 계층에서 계산된다.
}
