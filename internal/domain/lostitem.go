package domain

// 분실물 기록 유형.
const (
	LostFound    = "found"    // 습득: 물건을 먼저 보관하고, 주인이 나타나면 정보를 채운다
	LostReported = "reported" // 접수: 잃어버린 학생이 먼저 신고하고, 물건을 찾으면 돌려준다
)

// LostItem 은 분실물 습득·접수 기록이다.
// 두 유형은 항목이 같고 학생 정보를 채우는 시점만 다르다
// (습득은 회수할 때, 접수는 신고할 때).
type LostItem struct {
	ID      int64  `json:"id"`
	Type    string `json:"type"`    // found | reported
	Date    string `json:"date"`    // 습득·접수 일자 (YYYY-MM-DD)
	Item    string `json:"item"`    // 분실물
	Feature string `json:"feature"` // 특징 (색상·모양 등)

	StudentID string `json:"studentId"` // 학번
	Name      string `json:"name"`      // 이름
	Phone     string `json:"phone"`     // 연락처

	ClaimDate  string `json:"claimDate"`  // 회수 날짜
	ClaimStaff string `json:"claimStaff"` // 회수 확인자 (근로자)
}

// Claimed 는 회수 완료 여부다.
func (l LostItem) Claimed() bool { return l.ClaimDate != "" }
