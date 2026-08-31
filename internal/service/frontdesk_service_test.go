package service

import (
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupFrontDesk(t *testing.T) *FrontDeskService {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewFrontDeskService(sqlite.NewRentalRepo(db), sqlite.NewLostItemRepo(db),
		fixedClock("2026-08-25T13:20:00+09:00"))
}

func TestRentAndReturn(t *testing.T) {
	svc := setupFrontDesk(t)

	r, err := svc.Rent(domain.Rental{
		Staff: "홍길동", StudentID: "2021000111", Name: "김서연",
		Phone: "010-1234-5678", Place: "4층 세미나실", DeviceNo: "HDMI-02",
	})
	if err != nil {
		t.Fatalf("Rent: %v", err)
	}
	// 대여 일자·시간은 현재 시각으로 자동 기록된다
	if r.Date != "2026-08-25" || r.Time != "13:20" {
		t.Errorf("대여 일시 = %s %s", r.Date, r.Time)
	}

	// 대여자명이 없으면 거부
	if _, err := svc.Rent(domain.Rental{Staff: "홍길동", Place: "4층"}); err == nil {
		t.Error("대여자명 없이 대여되면 안 됩니다")
	}

	// 미반납 목록에 잡힌다
	out, err := svc.OutstandingRentals()
	if err != nil || len(out) != 1 {
		t.Fatalf("미반납 = %d (err=%v)", len(out), err)
	}

	if err := svc.ReturnRental(r.ID, "박준호"); err != nil {
		t.Fatalf("ReturnRental: %v", err)
	}
	list, _ := svc.Rentals()
	if !list[0].Returned() || list[0].ReturnStaff != "박준호" || list[0].ReturnTime != "13:20" {
		t.Errorf("반납 후 = %+v", list[0])
	}
	if out, _ = svc.OutstandingRentals(); len(out) != 0 {
		t.Errorf("반납 후 미반납 = %d", len(out))
	}
	// 이미 반납한 건은 다시 반납 처리되지 않는다
	if err := svc.ReturnRental(r.ID, "박준호"); err == nil {
		t.Error("중복 반납은 거부해야 합니다")
	}
}

func TestLostItemFlow(t *testing.T) {
	svc := setupFrontDesk(t)

	// 습득: 물건만 기록
	found, err := svc.RecordFound("우산", "검정 장우산")
	if err != nil || found.Type != domain.LostFound || found.Date != "2026-08-25" {
		t.Fatalf("RecordFound = %+v, err=%v", found, err)
	}
	if _, err := svc.RecordFound("", "특징만"); err == nil {
		t.Error("분실물 이름 없이 등록되면 안 됩니다")
	}

	// 접수: 학생 정보까지 함께 기록
	rep, err := svc.RecordReported("이어폰", "흰색 무선", "20250001", "홍길동", "010-0000-0000")
	if err != nil || rep.Type != domain.LostReported || rep.Name != "홍길동" {
		t.Fatalf("RecordReported = %+v, err=%v", rep, err)
	}
	if _, err := svc.RecordReported("가방", "검정", "", "", ""); err == nil {
		t.Error("접수는 학생 이름이 필요합니다")
	}

	// 습득물 회수: 찾아간 학생 정보를 이때 채운다
	if err := svc.ClaimFound(found.ID, "2021000111", "김서연", "010-1111-2222", "박준호"); err != nil {
		t.Fatalf("ClaimFound: %v", err)
	}
	fs, _ := svc.LostItems(domain.LostFound)
	if !fs[0].Claimed() || fs[0].Name != "김서연" || fs[0].ClaimStaff != "박준호" || fs[0].ClaimDate != "2026-08-25" {
		t.Errorf("회수 후 = %+v", fs[0])
	}

	// 접수건 회수: 학생 정보는 이미 있으므로 확인자만 기록
	if err := svc.ClaimReported(rep.ID, "박준호"); err != nil {
		t.Fatalf("ClaimReported: %v", err)
	}
	rs, _ := svc.LostItems(domain.LostReported)
	if !rs[0].Claimed() || rs[0].ClaimStaff != "박준호" {
		t.Errorf("접수 회수 후 = %+v", rs[0])
	}
	// 중복 회수 거부
	if err := svc.ClaimReported(rep.ID, "박준호"); err == nil {
		t.Error("중복 회수는 거부해야 합니다")
	}

	// 미회수 목록
	if pending, _ := svc.PendingLostItems(); len(pending) != 0 {
		t.Errorf("미회수 = %d, want 0", len(pending))
	}
}
