package googledrive

import "holmz/internal/domain"

// 데스크 업무 스프레드시트("HOLMZ_대여·분실물")의 시트별 행 생성.

func rentalRows(rentals []domain.Rental) [][]any {
	rows := [][]any{{"대여 일자", "대여 시간", "대여 담당자", "학번", "대여자명", "연락처", "사용장소", "HDMI 번호",
		"반납 일자", "반납 시간", "반납 확인자", "상태"}}
	for _, r := range rentals {
		status := "미반납"
		returnDate := ""
		if r.Returned() {
			status = "반납 완료"
			returnDate = sheetDate(r.ReturnDate)
		}
		rows = append(rows, []any{
			sheetDate(r.Date), r.Time, r.Staff, r.StudentID, r.Name, r.Phone, r.Place, r.DeviceNo,
			returnDate, r.ReturnTime, r.ReturnStaff, status,
		})
	}
	return rows
}

// foundItemRows 는 습득한 분실물을 기록한다 (학생 정보는 회수 시 채워진다).
func foundItemRows(items []domain.LostItem) [][]any {
	rows := [][]any{{"습득 날짜", "분실물", "특징", "학번", "이름", "전화번호", "회수 날짜", "회수 확인자", "상태"}}
	for _, v := range items {
		if v.Type != domain.LostFound {
			continue
		}
		rows = append(rows, lostItemRow(v, "보관 중"))
	}
	return rows
}

// reportedItemRows 는 학생이 신고한 분실물 접수를 기록한다.
func reportedItemRows(items []domain.LostItem) [][]any {
	rows := [][]any{{"접수 날짜", "분실물", "특징", "학번", "이름", "연락처", "회수 날짜", "회수 확인자", "상태"}}
	for _, v := range items {
		if v.Type != domain.LostReported {
			continue
		}
		rows = append(rows, lostItemRow(v, "찾는 중"))
	}
	return rows
}

// lostItemRow 는 습득·접수 공통 행을 만든다. pendingStatus 는 아직 회수되지 않았을 때의 표기다.
func lostItemRow(v domain.LostItem, pendingStatus string) []any {
	status, claimDate := pendingStatus, ""
	if v.Claimed() {
		status = "회수 완료"
		claimDate = sheetDate(v.ClaimDate)
	}
	return []any{
		sheetDate(v.Date), v.Item, v.Feature, v.StudentID, v.Name, v.Phone,
		claimDate, v.ClaimStaff, status,
	}
}
