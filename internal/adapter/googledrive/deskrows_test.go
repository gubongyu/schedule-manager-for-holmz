package googledrive

import (
	"reflect"
	"testing"

	"holmz/internal/domain"
)

func TestRentalRows(t *testing.T) {
	rows := rentalRows([]domain.Rental{
		{Date: "2026-08-25", Time: "13:20", Staff: "홍길동", StudentID: "2021000111", Name: "김서연",
			Phone: "010-1234-5678", Place: "4층 세미나실", DeviceNo: "HDMI-02",
			ReturnDate: "2026-08-25", ReturnTime: "17:05", ReturnStaff: "박준호"},
		{Date: "2026-08-26", Time: "10:00", Staff: "박준호", Name: "이하늘", Place: "2층 열람실"},
	})
	want := [][]any{
		{"대여 일자", "대여 시간", "대여 담당자", "학번", "대여자명", "연락처", "사용장소", "HDMI 번호",
			"반납 일자", "반납 시간", "반납 확인자", "상태"},
		{"2026. 8. 25", "13:20", "홍길동", "2021000111", "김서연", "010-1234-5678", "4층 세미나실", "HDMI-02",
			"2026. 8. 25", "17:05", "박준호", "반납 완료"},
		{"2026. 8. 26", "10:00", "박준호", "", "이하늘", "", "2층 열람실", "",
			"", "", "", "미반납"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("rentalRows:\n got: %v\nwant: %v", rows, want)
	}
}

func TestFoundItemRows(t *testing.T) {
	rows := foundItemRows([]domain.LostItem{
		{Type: domain.LostFound, Date: "2026-08-24", Item: "우산", Feature: "검정 장우산",
			StudentID: "2021000111", Name: "김서연", Phone: "010-1111-2222",
			ClaimDate: "2026-08-26", ClaimStaff: "박준호"},
		{Type: domain.LostFound, Date: "2026-08-25", Item: "텀블러", Feature: "은색"},
		{Type: domain.LostReported, Date: "2026-08-25", Item: "이어폰"}, // 접수건은 제외
	})
	want := [][]any{
		{"습득 날짜", "분실물", "특징", "학번", "이름", "전화번호", "회수 날짜", "회수 확인자", "상태"},
		{"2026. 8. 24", "우산", "검정 장우산", "2021000111", "김서연", "010-1111-2222",
			"2026. 8. 26", "박준호", "회수 완료"},
		{"2026. 8. 25", "텀블러", "은색", "", "", "", "", "", "보관 중"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("foundItemRows:\n got: %v\nwant: %v", rows, want)
	}
}

func TestReportedItemRows(t *testing.T) {
	rows := reportedItemRows([]domain.LostItem{
		{Type: domain.LostReported, Date: "2026-08-25", Item: "이어폰", Feature: "흰색 무선",
			StudentID: "20250001", Name: "홍길동", Phone: "010-0000-0000"},
		{Type: domain.LostFound, Date: "2026-08-24", Item: "우산"}, // 습득건은 제외
	})
	want := [][]any{
		{"접수 날짜", "분실물", "특징", "학번", "이름", "연락처", "회수 날짜", "회수 확인자", "상태"},
		{"2026. 8. 25", "이어폰", "흰색 무선", "20250001", "홍길동", "010-0000-0000", "", "", "찾는 중"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("reportedItemRows:\n got: %v\nwant: %v", rows, want)
	}
}
