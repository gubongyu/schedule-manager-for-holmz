package service

import (
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupAuth(t *testing.T) (*AuthService, *domain.Employee, *domain.Employee) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emps := sqlite.NewEmployeeRepo(db)
	withPin := &domain.Employee{Name: "김철수", PIN: "1234", Active: true}
	noPin := &domain.Employee{Name: "이영희", Active: true}
	for _, e := range []*domain.Employee{withPin, noPin} {
		if err := emps.Create(e); err != nil {
			t.Fatal(err)
		}
	}
	return NewAuthService(emps, sqlite.NewSettingsRepo(db)), withPin, noPin
}

func TestVerifyEmployeePIN(t *testing.T) {
	svc, withPin, noPin := setupAuth(t)

	if ok, err := svc.VerifyEmployeePIN(withPin.ID, "1234"); err != nil || !ok {
		t.Errorf("correct PIN = %v, %v; want true", ok, err)
	}
	if ok, _ := svc.VerifyEmployeePIN(withPin.ID, "0000"); ok {
		t.Error("wrong PIN accepted")
	}
	// PIN 미설정 직원은 검증 없이 통과
	if ok, _ := svc.VerifyEmployeePIN(noPin.ID, ""); !ok {
		t.Error("employee without PIN should pass")
	}
	if _, err := svc.VerifyEmployeePIN(999, "1234"); err == nil {
		t.Error("unknown employee should error")
	}
}

func TestEmployeeNeedsPIN(t *testing.T) {
	svc, withPin, noPin := setupAuth(t)
	if need, _ := svc.EmployeeNeedsPIN(withPin.ID); !need {
		t.Error("employee with PIN should need verification")
	}
	if need, _ := svc.EmployeeNeedsPIN(noPin.ID); need {
		t.Error("employee without PIN should not need verification")
	}
}

func TestAdminPIN(t *testing.T) {
	svc, _, _ := setupAuth(t)

	// 미설정 상태: 잠금 없음, 아무 PIN이나 통과
	if has, _ := svc.HasAdminPIN(); has {
		t.Error("HasAdminPIN before set = true, want false")
	}
	if ok, _ := svc.VerifyAdminPIN(""); !ok {
		t.Error("no admin PIN set should pass")
	}

	if err := svc.SetAdminPIN("9999"); err != nil {
		t.Fatalf("SetAdminPIN: %v", err)
	}
	if has, _ := svc.HasAdminPIN(); !has {
		t.Error("HasAdminPIN after set = false")
	}
	if ok, _ := svc.VerifyAdminPIN("9999"); !ok {
		t.Error("correct admin PIN rejected")
	}
	if ok, _ := svc.VerifyAdminPIN("0000"); ok {
		t.Error("wrong admin PIN accepted")
	}

	// 빈 값으로 재설정 → 잠금 해제
	if err := svc.SetAdminPIN(""); err != nil {
		t.Fatal(err)
	}
	if has, _ := svc.HasAdminPIN(); has {
		t.Error("clearing admin PIN should disable lock")
	}
}
