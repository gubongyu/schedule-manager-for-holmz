package service

import (
	"strings"

	"golang.org/x/crypto/bcrypt"

	"holmz/internal/domain"
)

const (
	adminPINKey     = "admin_pin"
	adminNameKey    = "admin_name"
	defaultAdmin    = "admin"
	defaultAdminPIN = "0000000000"
)

// LoginResult 는 접속 인증 결과다.
type LoginResult struct {
	Role         string `json:"role"` // admin | employee
	EmployeeID   int64  `json:"employeeId"`
	EmployeeName string `json:"employeeName"`
}

// AuthService 는 근무자 본인 확인(학번)과 관리자 메뉴 잠금(PIN)을 담당한다.
// 학번은 관리자 화면에 표시되어야 하는 식별 정보라 평문 비교하고,
// 관리자 PIN은 bcrypt 해시로 저장한다 (구버전 평문은 검증 성공 시 자동 승격).
type AuthService struct {
	employees domain.EmployeeRepo
	settings  domain.SettingsRepo
}

func NewAuthService(employees domain.EmployeeRepo, settings domain.SettingsRepo) *AuthService {
	return &AuthService{employees: employees, settings: settings}
}

func hashPIN(pin string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	return string(h), err
}

// pinMatches 는 저장값과 PIN을 비교한다. legacy 는 저장값이 평문(구버전)이었는지 여부다.
func pinMatches(stored, pin string) (ok, legacy bool) {
	if strings.HasPrefix(stored, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(stored), []byte(pin)) == nil, false
	}
	return stored == pin, true
}

// --- 근무자 본인 확인 (학번) ---

// EmployeeNeedsVerify 는 해당 직원 선택 시 학번 입력이 필요한지 알려준다 (학번 미등록 직원은 통과).
func (s *AuthService) EmployeeNeedsVerify(employeeID int64) (bool, error) {
	e, err := s.employees.Get(employeeID)
	if err != nil {
		return false, err
	}
	return e.StudentID != "", nil
}

// VerifyEmployee 는 입력한 학번이 등록된 학번과 일치하는지 확인한다.
func (s *AuthService) VerifyEmployee(employeeID int64, studentID string) (bool, error) {
	e, err := s.employees.Get(employeeID)
	if err != nil {
		return false, err
	}
	return e.StudentID == "" || e.StudentID == strings.TrimSpace(studentID), nil
}

// --- 접속 (이름 + 학번/PIN) ---

// EnsureDefaultAdmin 은 관리자 PIN이 아직 없으면 초기 계정(admin / 0000000000)을 만든다.
// 이미 PIN이 설정된 뒤에는 아무것도 하지 않는다 (기본값으로 되돌리지 않음).
func (s *AuthService) EnsureDefaultAdmin() error {
	has, err := s.HasAdminPIN()
	if err != nil || has {
		return err
	}
	return s.SetAdminPIN(defaultAdminPIN)
}

// AdminName 은 관리자 접속 이름을 반환한다 (미설정 시 "admin").
func (s *AuthService) AdminName() (string, error) {
	v, err := s.settings.Get(adminNameKey)
	if err != nil {
		return "", err
	}
	if v == "" {
		v = defaultAdmin
	}
	return v, nil
}

func (s *AuthService) SetAdminName(name string) error {
	return s.settings.Set(adminNameKey, strings.TrimSpace(name))
}

// Login 은 이름+비밀값으로 접속을 인증한다. 관리자는 관리자 이름+PIN,
// 직원은 등록된 이름+학번으로 확인한다. 실패 시 (nil, nil).
func (s *AuthService) Login(name, secret string) (*LoginResult, error) {
	name, secret = strings.TrimSpace(name), strings.TrimSpace(secret)
	if name == "" || secret == "" {
		return nil, nil
	}
	adminName, err := s.AdminName()
	if err != nil {
		return nil, err
	}
	if name == adminName {
		ok, err := s.VerifyAdminPIN(secret)
		if err != nil {
			return nil, err
		}
		if ok {
			return &LoginResult{Role: "admin"}, nil
		}
		return nil, nil
	}
	list, err := s.employees.List(true)
	if err != nil {
		return nil, err
	}
	for _, e := range list {
		if e.Name == name && e.StudentID != "" && e.StudentID == secret {
			return &LoginResult{Role: "employee", EmployeeID: e.ID, EmployeeName: e.Name}, nil
		}
	}
	return nil, nil
}

// --- 관리자 PIN ---

func (s *AuthService) HasAdminPIN() (bool, error) {
	v, err := s.settings.Get(adminPINKey)
	return v != "", err
}

// SetAdminPIN 은 관리자 PIN을 해시로 저장한다. 빈 값이면 잠금 해제.
func (s *AuthService) SetAdminPIN(pin string) error {
	if pin == "" {
		return s.settings.Set(adminPINKey, "")
	}
	h, err := hashPIN(pin)
	if err != nil {
		return err
	}
	return s.settings.Set(adminPINKey, h)
}

func (s *AuthService) VerifyAdminPIN(pin string) (bool, error) {
	stored, err := s.settings.Get(adminPINKey)
	if err != nil {
		return false, err
	}
	if stored == "" {
		return true, nil
	}
	ok, legacy := pinMatches(stored, pin)
	if ok && legacy {
		if h, err := hashPIN(pin); err == nil {
			_ = s.settings.Set(adminPINKey, h)
		}
	}
	return ok, nil
}
