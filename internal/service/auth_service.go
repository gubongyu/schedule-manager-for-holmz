package service

import "holmz/internal/domain"

const adminPINKey = "admin_pin"

// AuthService 는 근무자 PIN 확인과 관리자 메뉴 잠금을 담당한다 (기획서 9장: 다중 사용자 구분).
// PIN이 비어 있는 직원·미설정 관리자 잠금은 검증 없이 통과한다.
type AuthService struct {
	employees domain.EmployeeRepo
	settings  domain.SettingsRepo
}

func NewAuthService(employees domain.EmployeeRepo, settings domain.SettingsRepo) *AuthService {
	return &AuthService{employees: employees, settings: settings}
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
	return e.PIN == "" || e.PIN == pin, nil
}

func (s *AuthService) HasAdminPIN() (bool, error) {
	v, err := s.settings.Get(adminPINKey)
	return v != "", err
}

func (s *AuthService) SetAdminPIN(pin string) error {
	return s.settings.Set(adminPINKey, pin)
}

func (s *AuthService) VerifyAdminPIN(pin string) (bool, error) {
	v, err := s.settings.Get(adminPINKey)
	if err != nil {
		return false, err
	}
	return v == "" || v == pin, nil
}
