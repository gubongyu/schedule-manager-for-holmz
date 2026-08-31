package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestRentalRepoRoundTripAndReturn(t *testing.T) {
	db := openTestDB(t)
	repo := NewRentalRepo(db)

	r := &domain.Rental{
		Date: "2026-08-25", Time: "13:20", Staff: "홍길동",
		StudentID: "2021000111", Name: "김서연", Phone: "010-1234-5678",
		Place: "4층 세미나실", DeviceNo: "HDMI-02",
	}
	if err := repo.Create(r); err != nil || r.ID == 0 {
		t.Fatalf("Create: %v (id=%d)", err, r.ID)
	}

	list, err := repo.List()
	if err != nil || len(list) != 1 {
		t.Fatalf("List = %d (err=%v)", len(list), err)
	}
	got := list[0]
	if got.Name != "김서연" || got.Place != "4층 세미나실" || got.DeviceNo != "HDMI-02" || got.Returned() {
		t.Errorf("저장 내용 = %+v", got)
	}

	// 반납 처리
	got.ReturnDate, got.ReturnTime, got.ReturnStaff = "2026-08-25", "17:05", "박준호"
	if err := repo.Update(&got); err != nil {
		t.Fatalf("Update: %v", err)
	}
	list, _ = repo.List()
	if !list[0].Returned() || list[0].ReturnStaff != "박준호" || list[0].ReturnTime != "17:05" {
		t.Errorf("반납 후 = %+v", list[0])
	}

	// HDMI 번호가 없어도 저장된다
	if err := repo.Create(&domain.Rental{Date: "2026-08-26", Time: "10:00", Name: "이하늘"}); err != nil {
		t.Fatalf("번호 없는 대여: %v", err)
	}
	if list, _ = repo.List(); len(list) != 2 || list[0].Date != "2026-08-26" {
		t.Errorf("최근순 정렬 실패: %+v", list)
	}

	if err := repo.Delete(r.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ = repo.List(); len(list) != 1 {
		t.Errorf("삭제 후 = %d", len(list))
	}
}

func TestLostItemRepoByType(t *testing.T) {
	db := openTestDB(t)
	repo := NewLostItemRepo(db)

	found := &domain.LostItem{Type: domain.LostFound, Date: "2026-08-24", Item: "우산", Feature: "검정 장우산"}
	reported := &domain.LostItem{Type: domain.LostReported, Date: "2026-08-25", Item: "이어폰",
		Feature: "흰색 무선", StudentID: "20250001", Name: "홍길동", Phone: "010-0000-0000"}
	for _, v := range []*domain.LostItem{found, reported} {
		if err := repo.Create(v); err != nil || v.ID == 0 {
			t.Fatalf("Create: %v", err)
		}
	}

	if all, err := repo.List(""); err != nil || len(all) != 2 {
		t.Fatalf("List(전체) = %d (err=%v)", len(all), err)
	}
	fs, err := repo.List(domain.LostFound)
	if err != nil || len(fs) != 1 || fs[0].Item != "우산" || fs[0].Claimed() {
		t.Fatalf("List(습득) = %+v, err=%v", fs, err)
	}
	rs, _ := repo.List(domain.LostReported)
	if len(rs) != 1 || rs[0].Name != "홍길동" {
		t.Errorf("List(접수) = %+v", rs)
	}

	// 회수 처리 (습득물은 이때 학생 정보를 채운다)
	fs[0].StudentID, fs[0].Name, fs[0].Phone = "2021000111", "김서연", "010-1111-2222"
	fs[0].ClaimDate, fs[0].ClaimStaff = "2026-08-26", "박준호"
	if err := repo.Update(&fs[0]); err != nil {
		t.Fatalf("Update: %v", err)
	}
	fs, _ = repo.List(domain.LostFound)
	if !fs[0].Claimed() || fs[0].Name != "김서연" || fs[0].ClaimStaff != "박준호" {
		t.Errorf("회수 후 = %+v", fs[0])
	}
}
