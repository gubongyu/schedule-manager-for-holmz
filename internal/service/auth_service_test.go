package service

import (
	"path/filepath"
	"strings"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupAuth(t *testing.T) (*AuthService, *sqlite.SettingsRepo, *domain.Employee, *domain.Employee) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emps := sqlite.NewEmployeeRepo(db)
	withID := &domain.Employee{Name: "김철수", StudentID: "20261234", Department: "컴공", Active: true}
	noID := &domain.Employee{Name: "이영희", Active: true}
	for _, e := range []*domain.Employee{withID, noID} {
		if err := emps.Create(e); err != nil {
			t.Fatal(err)
		}
	}
	settings := sqlite.NewSettingsRepo(db)
	return NewAuthService(emps, settings), settings, withID, noID
}

func TestVerifyEmployeeByStudentID(t *testing.T) {
	svc, _, withID, noID := setupAuth(t)

	if ok, err := svc.VerifyEmployee(withID.ID, "20261234"); err != nil || !ok {
		t.Errorf("correct studentID = %v, %v; want true", ok, err)
	}
	// 공백은 허용 (실수 방지)
	if ok, _ := svc.VerifyEmployee(withID.ID, " 20261234 "); !ok {
		t.Error("trimmed studentID should pass")
	}
	if ok, _ := svc.VerifyEmployee(withID.ID, "99999999"); ok {
		t.Error("wrong studentID accepted")
	}
	// 학번 미등록 직원은 검증 없이 통과
	if ok, _ := svc.VerifyEmployee(noID.ID, ""); !ok {
		t.Error("employee without studentID should pass")
	}
	if _, err := svc.VerifyEmployee(999, "x"); err == nil {
		t.Error("unknown employee should error")
	}
}

func TestEmployeeNeedsVerify(t *testing.T) {
	svc, _, withID, noID := setupAuth(t)
	if need, _ := svc.EmployeeNeedsVerify(withID.ID); !need {
		t.Error("employee with studentID should need verification")
	}
	if need, _ := svc.EmployeeNeedsVerify(noID.ID); need {
		t.Error("employee without studentID should not need verification")
	}
}

func TestAdminPINStoredHashed(t *testing.T) {
	svc, settings, _, _ := setupAuth(t)

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
