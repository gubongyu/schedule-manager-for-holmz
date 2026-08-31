package main

// 접속·본인 확인 관련 바인딩.

import (
	"errors"

	"holmz/internal/service"
)

// Login 은 이름+학번(직원) 또는 이름+PIN(관리자)으로 접속을 인증한다. 실패 시 nil.
func (a *App) Login(name, secret string) (*service.LoginResult, error) {
	return a.auth.Login(name, secret)
}

func (a *App) AdminName() (string, error) { return a.auth.AdminName() }

// SetAdminAccount 은 현재 PIN 확인 후 관리자 이름·PIN을 변경한다 (빈 값은 유지).
func (a *App) SetAdminAccount(currentPIN, newName, newPIN string) error {
	if err := a.requireAdminPIN(currentPIN); err != nil {
		return err
	}
	if newName != "" {
		if err := a.auth.SetAdminName(newName); err != nil {
			return err
		}
	}
	if newPIN != "" {
		return a.auth.SetAdminPIN(newPIN)
	}
	return nil
}

// SetAdminPIN 은 현재 PIN 확인 후 새 PIN을 저장한다. 빈 값이면 잠금 해제.
func (a *App) SetAdminPIN(currentPIN, newPIN string) error {
	if err := a.requireAdminPIN(currentPIN); err != nil {
		return err
	}
	return a.auth.SetAdminPIN(newPIN)
}

// requireAdminPIN 은 관리자 설정 변경 전 현재 PIN을 확인한다.
func (a *App) requireAdminPIN(pin string) error {
	ok, err := a.auth.VerifyAdminPIN(pin)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("현재 관리자 PIN이 일치하지 않습니다")
	}
	return nil
}

func (a *App) HasAdminPIN() (bool, error) { return a.auth.HasAdminPIN() }

func (a *App) VerifyAdminPIN(pin string) (bool, error) { return a.auth.VerifyAdminPIN(pin) }

func (a *App) EmployeeNeedsVerify(employeeID int64) (bool, error) {
	return a.auth.EmployeeNeedsVerify(employeeID)
}

func (a *App) VerifyEmployee(employeeID int64, studentID string) (bool, error) {
	return a.auth.VerifyEmployee(employeeID, studentID)
}
