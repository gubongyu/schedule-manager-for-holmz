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

func TestEnsureDefaultAdminSeedsOnce(t *testing.T) {
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	svc := NewAuthService(sqlite.NewEmployeeRepo(db), sqlite.NewSettingsRepo(db))

	if err := svc.EnsureDefaultAdmin(); err != nil {
		t.Fatalf("EnsureDefaultAdmin: %v", err)
	}
	// 초기 관리자: admin / 0000000000
	res, err := svc.Login("admin", "0000000000")
	if err != nil || res == nil || res.Role != "admin" {
		t.Fatalf("default admin login = %+v, err=%v", res, err)
	}

	// 관리자가 PIN을 바꾼 뒤 다시 호출해도 기본값으로 되돌리지 않는다
	if err := svc.SetAdminPIN("9999"); err != nil {
		t.Fatal(err)
	}
	if err := svc.EnsureDefaultAdmin(); err != nil {
		t.Fatal(err)
	}
	if res, _ := svc.Login("admin", "0000000000"); res != nil {
		t.Error("old default PIN should not work after change")
	}
	if res, _ := svc.Login("admin", "9999"); res == nil || res.Role != "admin" {
		t.Error("new PIN login failed")
	}
}

func TestLogin(t *testing.T) {
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emps := sqlite.NewEmployeeRepo(db)
	emp := &domain.Employee{Name: "홍길동", StudentID: "20250001", Active: true}
	inactive := &domain.Employee{Name: "퇴사자", StudentID: "2019000001", Active: false}
	for _, e := range []*domain.Employee{emp, inactive} {
		if err := emps.Create(e); err != nil {
			t.Fatal(err)
		}
	}
	svc := NewAuthService(emps, sqlite.NewSettingsRepo(db))
	if err := svc.EnsureDefaultAdmin(); err != nil {
		t.Fatal(err)
	}

	// 직원: 이름 + 학번
	res, err := svc.Login("홍길동", "20250001")
	if err != nil || res == nil || res.Role != "employee" || res.EmployeeID != emp.ID || res.EmployeeName != "홍길동" {
		t.Fatalf("employee login = %+v, err=%v", res, err)
	}
	// 공백 허용
	if res, _ := svc.Login(" 홍길동 ", " 20250001 "); res == nil {
		t.Error("trimmed login should pass")
	}
	// 잘못된 학번 / 없는 이름 / 비활성 직원 → nil
	if res, _ := svc.Login("홍길동", "0000"); res != nil {
		t.Error("wrong student id should fail")
	}
	if res, _ := svc.Login("없는사람", "20250001"); res != nil {
		t.Error("unknown name should fail")
	}
	if res, _ := svc.Login("퇴사자", "2019000001"); res != nil {
		t.Error("inactive employee should fail")
	}
	// 관리자 이름 + 직원 학번 조합 → 실패
	if res, _ := svc.Login("admin", "20250001"); res != nil {
		t.Error("admin with wrong pin should fail")
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
