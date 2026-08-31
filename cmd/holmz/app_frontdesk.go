package main

// 데스크 업무(HDMI 대여, 분실물 습득·접수) 바인딩.

import "holmz/internal/domain"

// --- HDMI 대여 ---

// RentHDMI 는 대여를 기록한다 (대여 일자·시간은 현재 시각으로 자동 기록).
func (a *App) RentHDMI(staff, studentID, name, phone, place, deviceNo string) (*domain.Rental, error) {
	return a.frontDesk.Rent(domain.Rental{
		Staff: staff, StudentID: studentID, Name: name,
		Phone: phone, Place: place, DeviceNo: deviceNo,
	})
}

func (a *App) Rentals() ([]domain.Rental, error) { return a.frontDesk.Rentals() }

func (a *App) OutstandingRentals() ([]domain.Rental, error) { return a.frontDesk.OutstandingRentals() }

// ReturnHDMI 는 반납 일시와 확인자를 기록한다.
func (a *App) ReturnHDMI(id int64, staff string) error { return a.frontDesk.ReturnRental(id, staff) }

func (a *App) DeleteRental(id int64) error { return a.frontDesk.DeleteRental(id) }

// --- 분실물 ---

// RecordFoundItem 은 습득한 분실물을 기록한다 (학생 정보는 회수 때 채운다).
func (a *App) RecordFoundItem(item, feature string) (*domain.LostItem, error) {
	return a.frontDesk.RecordFound(item, feature)
}

// RecordLostReport 는 학생의 분실 신고를 접수한다.
func (a *App) RecordLostReport(item, feature, studentID, name, phone string) (*domain.LostItem, error) {
	return a.frontDesk.RecordReported(item, feature, studentID, name, phone)
}

// LostItems 는 유형별 기록을 반환한다 (found | reported, 빈 문자열이면 전체).
func (a *App) LostItems(typ string) ([]domain.LostItem, error) { return a.frontDesk.LostItems(typ) }

// ClaimFoundItem 은 습득물을 찾아간 학생 정보와 회수 정보를 기록한다.
func (a *App) ClaimFoundItem(id int64, studentID, name, phone, staff string) error {
	return a.frontDesk.ClaimFound(id, studentID, name, phone, staff)
}

// ClaimLostReport 는 접수 건을 회수 처리한다.
func (a *App) ClaimLostReport(id int64, staff string) error {
	return a.frontDesk.ClaimReported(id, staff)
}

func (a *App) DeleteLostItem(id int64) error { return a.frontDesk.DeleteLostItem(id) }
