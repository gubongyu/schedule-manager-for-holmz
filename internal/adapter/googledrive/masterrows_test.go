package googledrive

import (
	"reflect"
	"testing"

	"holmz/internal/domain"
)

func TestEmployeeRows(t *testing.T) {
	rows := employeeRows([]domain.Employee{
		{Name: "홍길동", StudentID: "20250001", Department: "컴퓨터공학과", StartDate: "2026-03-02", Active: true},
		{Name: "시작일없음", StudentID: "2019000001", Department: "", Active: true},
	})
	want := [][]any{
		{"학과", "이름", "학번", "근로 종료일"},
		{"컴퓨터공학과", "홍길동", "20250001", "2027-02-02"}, // 시작일 +11개월
		{"", "시작일없음", "2019000001", ""},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("employeeRows:\n got: %v\nwant: %v", rows, want)
	}
}

func TestShiftRows(t *testing.T) {
	rows := shiftRows([]domain.Shift{
		{Weekday: "FRI", EmployeeName: "홍길동", Start: "09:00", End: "15:00"},
		{Weekday: "MON", EmployeeName: "홍길동", Start: "10:00", End: "18:00"},
	})
	// 요일 순(월→일)으로 정렬되어야 한다
	want := [][]any{
		{"요일", "이름", "시작", "종료"},
		{"월", "홍길동", "10:00", "18:00"},
		{"금", "홍길동", "09:00", "15:00"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("shiftRows:\n got: %v\nwant: %v", rows, want)
	}
}

func TestOverrideRowsExcludeSubstitutions(t *testing.T) {
	rows := overrideRows([]domain.ShiftOverride{
		{Date: "2026-08-25", EmployeeName: "홍길동", Type: domain.OverrideOff, Note: "병원"},
		{Date: "2026-08-26", EmployeeName: "홍길동", Type: domain.OverrideWork, Start: "10:00", End: "14:00"},
		{Date: "2026-08-27", EmployeeName: "홍길동", Type: domain.OverrideSub, Start: "13:00", End: "15:00", CoverName: "박준호"},
	})
	want := [][]any{
		{"날짜", "이름", "유형", "시간", "메모"},
		{"2026. 8. 25", "홍길동", "휴가", "", "병원"},
		{"2026. 8. 26", "홍길동", "추가 근무", "10:00–14:00", ""},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("overrideRows(대타 제외):\n got: %v\nwant: %v", rows, want)
	}
}

// 대타 시트: 날짜 / 요일 / 시간 / 기존학생 / 대타학생
func TestSubstitutionRows(t *testing.T) {
	rows := substitutionRows([]domain.ShiftOverride{
		{Date: "2026-08-25", EmployeeName: "홍길동", Type: domain.OverrideOff, Note: "병원"},
		{Date: "2026-08-27", EmployeeName: "홍길동", Type: domain.OverrideSub, Start: "13:00", End: "15:00", CoverName: "박준호"},
		{Date: "2026-08-24", EmployeeName: "이하늘", Type: domain.OverrideSub, Start: "09:00", End: "12:00", CoverName: "최민서"},
	})
	want := [][]any{
		{"날짜", "요일", "시간", "기존학생", "대타학생"},
		{"2026. 8. 24", "월", "09:00–12:00", "이하늘", "최민서"}, // 날짜순 정렬
		{"2026. 8. 27", "목", "13:00–15:00", "홍길동", "박준호"},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("substitutionRows:\n got: %v\nwant: %v", rows, want)
	}
}
