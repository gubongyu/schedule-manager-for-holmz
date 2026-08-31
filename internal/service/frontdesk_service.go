package service

import (
	"fmt"
	"strings"
	"time"

	"holmz/internal/domain"
)

// FrontDeskService 는 데스크 업무(HDMI 대여, 분실물 습득·접수)를 처리한다.
// 일자·시각은 현재 시각으로 자동 기록해 근무자가 입력할 항목을 줄인다.
type FrontDeskService struct {
	rentals domain.RentalRepo
	lost    domain.LostItemRepo
	clock   func() time.Time
}

func NewFrontDeskService(rentals domain.RentalRepo, lost domain.LostItemRepo, clock func() time.Time) *FrontDeskService {
	if clock == nil {
		clock = time.Now
	}
	return &FrontDeskService{rentals: rentals, lost: lost, clock: clock}
}

func (s *FrontDeskService) now() (date, hm string) {
	t := s.clock()
	return t.Format("2006-01-02"), t.Format("15:04")
}

// --- HDMI 대여 ---

// Rent 는 대여를 기록한다. 대여 일자·시간은 지금 시각으로 채운다.
func (s *FrontDeskService) Rent(r domain.Rental) (*domain.Rental, error) {
	r.Name = strings.TrimSpace(r.Name)
	if r.Name == "" {
		return nil, fmt.Errorf("대여자명을 입력하세요")
	}
	r.Date, r.Time = s.now()
	r.ReturnDate, r.ReturnTime, r.ReturnStaff = "", "", ""
	if err := s.rentals.Create(&r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *FrontDeskService) Rentals() ([]domain.Rental, error) { return s.rentals.List() }

// OutstandingRentals 는 아직 반납되지 않은 대여를 반환한다.
func (s *FrontDeskService) OutstandingRentals() ([]domain.Rental, error) {
	all, err := s.rentals.List()
	if err != nil {
		return nil, err
	}
	out := []domain.Rental{}
	for _, r := range all {
		if !r.Returned() {
			out = append(out, r)
		}
	}
	return out, nil
}

// ReturnRental 은 반납 일시와 확인자를 기록한다.
func (s *FrontDeskService) ReturnRental(id int64, staff string) error {
	all, err := s.rentals.List()
	if err != nil {
		return err
	}
	for _, r := range all {
		if r.ID != id {
			continue
		}
		if r.Returned() {
			return fmt.Errorf("이미 반납 처리된 대여입니다")
		}
		r.ReturnDate, r.ReturnTime = s.now()
		r.ReturnStaff = strings.TrimSpace(staff)
		return s.rentals.Update(&r)
	}
	return fmt.Errorf("대여 기록을 찾을 수 없습니다 (id=%d)", id)
}

func (s *FrontDeskService) DeleteRental(id int64) error { return s.rentals.Delete(id) }

// --- 분실물 ---

// RecordFound 는 습득한 분실물을 기록한다 (학생 정보는 회수 때 채운다).
func (s *FrontDeskService) RecordFound(item, feature string) (*domain.LostItem, error) {
	return s.recordLost(domain.LostFound, item, feature, "", "", "")
}

// RecordReported 는 분실 신고를 접수한다 (학생 정보를 함께 기록한다).
func (s *FrontDeskService) RecordReported(item, feature, studentID, name, phone string) (*domain.LostItem, error) {
	if strings.TrimSpace(name) == "" {
		return nil, fmt.Errorf("접수하려면 학생 이름을 입력하세요")
	}
	return s.recordLost(domain.LostReported, item, feature, studentID, name, phone)
}

func (s *FrontDeskService) recordLost(typ, item, feature, studentID, name, phone string) (*domain.LostItem, error) {
	item = strings.TrimSpace(item)
	if item == "" {
		return nil, fmt.Errorf("분실물을 입력하세요")
	}
	date, _ := s.now()
	v := &domain.LostItem{
		Type: typ, Date: date, Item: item, Feature: strings.TrimSpace(feature),
		StudentID: strings.TrimSpace(studentID), Name: strings.TrimSpace(name), Phone: strings.TrimSpace(phone),
	}
	if err := s.lost.Create(v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *FrontDeskService) LostItems(typ string) ([]domain.LostItem, error) { return s.lost.List(typ) }

// PendingLostItems 는 아직 회수되지 않은 습득·접수 기록을 반환한다.
func (s *FrontDeskService) PendingLostItems() ([]domain.LostItem, error) {
	all, err := s.lost.List("")
	if err != nil {
		return nil, err
	}
	out := []domain.LostItem{}
	for _, v := range all {
		if !v.Claimed() {
			out = append(out, v)
		}
	}
	return out, nil
}

// ClaimFound 는 습득물을 찾아간 학생 정보와 회수 정보를 기록한다.
func (s *FrontDeskService) ClaimFound(id int64, studentID, name, phone, staff string) error {
	return s.claim(id, studentID, name, phone, staff)
}

// ClaimReported 는 접수 건을 회수 처리한다 (학생 정보는 접수 때 이미 기록됨).
func (s *FrontDeskService) ClaimReported(id int64, staff string) error {
	return s.claim(id, "", "", "", staff)
}

func (s *FrontDeskService) claim(id int64, studentID, name, phone, staff string) error {
	all, err := s.lost.List("")
	if err != nil {
		return err
	}
	for _, v := range all {
		if v.ID != id {
			continue
		}
		if v.Claimed() {
			return fmt.Errorf("이미 회수 처리된 기록입니다")
		}
		if s := strings.TrimSpace(studentID); s != "" {
			v.StudentID = s
		}
		if n := strings.TrimSpace(name); n != "" {
			v.Name = n
		}
		if p := strings.TrimSpace(phone); p != "" {
			v.Phone = p
		}
		v.ClaimDate, _ = s.now()
		v.ClaimStaff = strings.TrimSpace(staff)
		return s.lost.Update(&v)
	}
	return fmt.Errorf("분실물 기록을 찾을 수 없습니다 (id=%d)", id)
}

func (s *FrontDeskService) DeleteLostItem(id int64) error { return s.lost.Delete(id) }
