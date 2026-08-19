package service

import (
	"path/filepath"
	"strings"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupAuth(t *testing.T) (*AuthService, *sqlite.EmployeeRepo, *domain.Employee, *domain.Employee) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emps := sqlite.NewEmployeeRepo(db)
	withPin := &domain.Employee{Name: "김철수", Active: true}
	noPin := &domain.Employee{Name: "이영희", Active: true}
	for _, e := range []*domain.Employee{withPin, noPin} {
		if err := emps.Create(e); err != nil {
			t.Fatal(err)
		}
	}
	svc := NewAuthService(emps, sqlite.NewSettingsRepo(db))
	if err := svc.SetEmployeePIN(withPin.ID, "1234"); err != nil {
		t.Fatal(err)
	}
	return svc, emps, withPin, noPin
}

func TestEmployeePINStoredHashed(t *testing.T) {
	_, emps, withPin, _ := setupAuth(t)
	stored, err := emps.Get(withPin.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.PIN == "1234" || !strings.HasPrefix(stored.PIN, "$2") {
		t.Errorf("PIN stored as %q, want bcrypt hash", stored.PIN)
	}
}

func TestLegacyPlaintextPINUpgradedOnVerify(t *testing.T) {
	svc, emps, _, noPin := setupAuth(t)
	// 기존 배포본의 평문 PIN을 흉내낸다
	noPin.PIN = "5678"
	if err := emps.Update(noPin); err != nil {
		t.Fatal(err)
	}
	if ok, err := svc.VerifyEmployeePIN(noPin.ID, "5678"); err != nil || !ok {
		t.Fatalf("legacy PIN verify = %v, %v; want true", ok, err)
	}
	stored, _ := emps.Get(noPin.ID)
	if !strings.HasPrefix(stored.PIN, "$2") {
		t.Errorf("legacy PIN not upgraded to hash: %q", stored.PIN)
	}
	// 승격 후에도 같은 PIN으로 검증 가능
	if ok, _ := svc.VerifyEmployeePIN(noPin.ID, "5678"); !ok {
		t.Error("PIN verify after upgrade failed")
	}
}

func TestVerifyEmployeePIN(t *testing.T) {
	svc, _, withPin, noPin := setupAuth(t)

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
	svc, _, withPin, noPin := setupAuth(t)
	if need, _ := svc.EmployeeNeedsPIN(withPin.ID); !need {
		t.Error("employee with PIN should need verification")
	}
	if need, _ := svc.EmployeeNeedsPIN(noPin.ID); need {
		t.Error("employee without PIN should not need verification")
	}
}

func TestAdminPINStoredHashed(t *testing.T) {
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	settings := sqlite.NewSettingsRepo(db)
	svc := NewAuthService(sqlite.NewEmployeeRepo(db), settings)

	if err := svc.SetAdminPIN("9999"); err != nil {
		t.Fatal(err)
	}
	stored, _ := settings.Get("admin_pin")
	if stored == "9999" || !strings.HasPrefix(stored, "$2") {
		t.Errorf("admin PIN stored as %q, want bcrypt hash", stored)
	}

	// 레거시 평문 관리자 PIN → 검증 성공 시 해시로 승격
	if err := settings.Set("admin_pin", "1111"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := svc.VerifyAdminPIN("1111"); !ok {
		t.Fatal("legacy admin PIN verify failed")
	}
	stored, _ = settings.Get("admin_pin")
	if !strings.HasPrefix(stored, "$2") {
		t.Errorf("legacy admin PIN not upgraded: %q", stored)
	}
}

func TestAdminPIN(t *testing.T) {
	svc, _, _, _ := setupAuth(t)

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
