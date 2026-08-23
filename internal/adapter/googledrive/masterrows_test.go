package googledrive

import (
	"reflect"
	"testing"

	"holmz/internal/domain"
)

func TestEmployeeRows(t *testing.T) {
	rows := employeeRows([]domain.Employee{
		{Name: "홍길동", StudentID: "20250001", Department: "컴퓨터공학과", Active: true},
		{Name: "퇴사자", StudentID: "2019000001", Department: "", Active: false},
	})
	want := [][]any{
		{"이름", "학번", "학과", "상태"},
		{"홍길동", "20250001", "컴퓨터공학과", "재직"},
		{"퇴사자", "2019000001", "", "비활성"},
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

func TestOverrideRows(t *testing.T) {
	rows := overrideRows([]domain.ShiftOverride{
		{Date: "2026-08-25", EmployeeName: "홍길동", Type: domain.OverrideOff, Note: "병원"},
		{Date: "2026-08-26", EmployeeName: "홍길동", Type: domain.OverrideWork, Start: "10:00", End: "14:00"},
		{Date: "2026-08-27", EmployeeName: "홍길동", Type: domain.OverrideSub, Start: "13:00", End: "15:00", CoverName: "박준호"},
	})
	want := [][]any{
		{"날짜", "이름", "유형", "시간", "대체 근무자", "메모"},
		{"2026. 8. 25", "홍길동", "휴가", "", "", "병원"},
		{"2026. 8. 26", "홍길동", "추가 근무", "10:00–14:00", "", ""},
		{"2026. 8. 27", "홍길동", "대타", "13:00–15:00", "박준호", ""},
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("overrideRows:\n got: %v\nwant: %v", rows, want)
	}
}
