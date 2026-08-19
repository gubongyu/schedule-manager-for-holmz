package service

import (
	"strings"

	"golang.org/x/crypto/bcrypt"

	"holmz/internal/domain"
)

const adminPINKey = "admin_pin"

// AuthService 는 근무자 PIN 확인과 관리자 메뉴 잠금을 담당한다 (기획서 9장: 다중 사용자 구분).
// PIN은 bcrypt 해시로 저장한다. 구버전의 평문 PIN은 검증 성공 시 자동으로 해시로 승격된다.
// PIN이 비어 있는 직원·미설정 관리자 잠금은 검증 없이 통과한다.
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

// --- 근무자 PIN ---

// SetEmployeePIN 은 직원 PIN을 해시로 저장한다. 빈 값이면 PIN 해제.
func (s *AuthService) SetEmployeePIN(employeeID int64, pin string) error {
	e, err := s.employees.Get(employeeID)
	if err != nil {
		return err
	}
	if pin == "" {
		e.PIN = ""
	} else {
		if e.PIN, err = hashPIN(pin); err != nil {
			return err
		}
	}
	return s.employees.Update(e)
}

// EmployeeNeedsPIN 은 해당 직원 선택 시 PIN 입력이 필요한지 알려준다.
func (s *AuthService) EmployeeNeedsPIN(employeeID int64) (bool, error) {
	e, err := s.employees.Get(employeeID)
	if err != nil {
		return false, err
	}
	return e.PIN != "", nil
}

func (s *AuthService) VerifyEmployeePIN(employeeID int64, pin string) (bool, error) {
	e, err := s.employees.Get(employeeID)
	if err != nil {
		return false, err
	}
	if e.PIN == "" {
		return true, nil
	}
	ok, legacy := pinMatches(e.PIN, pin)
	if ok && legacy {
		// 평문 저장분을 해시로 승격 (실패해도 검증 결과에는 영향 없음)
		if h, err := hashPIN(pin); err == nil {
			e.PIN = h
			_ = s.employees.Update(e)
		}
	}
	return ok, nil
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
