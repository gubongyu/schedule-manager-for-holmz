package domain

import "testing"

func TestWorkEndDate(t *testing.T) {
	cases := map[string]string{
		"2026-03-02": "2027-02-02", // 기본: 11개월 뒤
		"2026-09-01": "2027-08-01",
		"2026-03-31": "2027-02-28", // 말일이 없는 달로 넘어가면 그 달 마지막 날
		"2027-03-31": "2028-02-29", // 윤년
		"":           "",           // 시작일 미입력
		"잘못된날짜":      "",
	}
	for start, want := range cases {
		e := Employee{StartDate: start}
		if got := e.WorkEndDate(); got != want {
			t.Errorf("StartDate %q → %q, want %q", start, got, want)
		}
	}
}
