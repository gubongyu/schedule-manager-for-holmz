package domain

import "testing"

func TestWorkLogTotalHours(t *testing.T) {
	w := WorkLog{ClockIn: "2026-08-19T09:00:00+09:00", ClockOut: "2026-08-19T18:30:00+09:00"}
	if got := w.TotalHours(); got != 9.5 {
		t.Errorf("TotalHours() = %v, want 9.5", got)
	}
}

func TestWorkLogTotalHoursOpenShift(t *testing.T) {
	w := WorkLog{ClockIn: "2026-08-19T09:00:00+09:00"}
	if got := w.TotalHours(); got != 0 {
		t.Errorf("TotalHours() with no clock-out = %v, want 0", got)
	}
}
