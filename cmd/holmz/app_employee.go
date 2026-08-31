package main

// 직원 관리 바인딩.

import "holmz/internal/domain"

func (a *App) ListEmployees(activeOnly bool) ([]domain.Employee, error) {
	return a.employees.List(activeOnly)
}

func (a *App) AddEmployee(name, studentID, department, startDate string) (*domain.Employee, error) {
	e := &domain.Employee{Name: name, StudentID: studentID, Department: department,
		StartDate: startDate, Active: true}
	if err := a.employees.Create(e); err != nil {
		return nil, err
	}
	return e, nil
}

// UpdateEmployee 는 이름·학번·학과·근무 시작일을 갱신한다 (활성 상태는 보존).
func (a *App) UpdateEmployee(e domain.Employee) error {
	stored, err := a.employees.Get(e.ID)
	if err != nil {
		return err
	}
	stored.Name = e.Name
	stored.StudentID = e.StudentID
	stored.Department = e.Department
	stored.StartDate = e.StartDate
	return a.employees.Update(stored)
}

// DeleteEmployee 는 직원을 목록에서 제거한다 (기존 근로기록 보존을 위한 soft-delete).
func (a *App) DeleteEmployee(id int64) error {
	stored, err := a.employees.Get(id)
	if err != nil {
		return err
	}
	stored.Active = false
	return a.employees.Update(stored)
}
