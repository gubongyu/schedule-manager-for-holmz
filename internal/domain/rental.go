package domain

// Rental 은 HDMI 대여 기록이다. 반납 정보는 반납 시점에 채워진다.
type Rental struct {
	ID        int64  `json:"id"`
	Date      string `json:"date"`      // 대여 일자 (YYYY-MM-DD)
	Time      string `json:"time"`      // 대여 시간 (HH:MM)
	Staff     string `json:"staff"`     // 대여 담당자
	StudentID string `json:"studentId"` // 대여자 학번
	Name      string `json:"name"`      // 대여자명
	Phone     string `json:"phone"`     // 연락처
	Place     string `json:"place"`     // 사용장소
	DeviceNo  string `json:"deviceNo"`  // HDMI 번호 (없을 수 있음)

	ReturnDate  string `json:"returnDate"`  // 반납 일자
	ReturnTime  string `json:"returnTime"`  // 반납 시간
	ReturnStaff string `json:"returnStaff"` // 반납 확인자
}

// Returned 는 반납 완료 여부다.
func (r Rental) Returned() bool { return r.ReturnTime != "" }
