package sqlite

import (
	"reflect"
	"testing"

	"holmz/internal/domain"
)

func TestScheduleRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewScheduleRepo(db)

	s := &domain.ScheduleItem{TaskName: "오픈 알림", RunTime: "09:00",
		RepeatDays: []string{"MON", "TUE"}, ActionType: domain.ActionNotifyOpen, Active: true}
	if err := repo.Create(s); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if s.ID == 0 {
		t.Fatal("Create did not set ID")
	}

	// 요일 없는 항목 (빈 슬라이스 라운드트립 확인)
	s2 := &domain.ScheduleItem{TaskName: "마감 업로드", RunTime: "22:00", ActionType: domain.ActionUpload, Active: true}
	if err := repo.Create(s2); err != nil {
		t.Fatal(err)
	}

	list, err := repo.List()
	if err != nil || len(list) != 2 {
		t.Fatalf("List = %d (err=%v), want 2", len(list), err)
	}
	if list[0].TaskName != "오픈 알림" || !reflect.DeepEqual(list[0].RepeatDays, []string{"MON", "TUE"}) {
		t.Errorf("list[0] = %+v", list[0])
	}
	if len(list[1].RepeatDays) != 0 {
		t.Errorf("empty RepeatDays roundtrip = %v, want empty", list[1].RepeatDays)
	}

	s.Active = false
	s.RepeatDays = []string{"SUN"}
	if err := repo.Update(s); err != nil {
		t.Fatalf("Update: %v", err)
	}
	list, _ = repo.List()
	if list[0].Active || !reflect.DeepEqual(list[0].RepeatDays, []string{"SUN"}) {
		t.Errorf("after update: %+v", list[0])
	}

	if err := repo.Delete(s2.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if list, _ = repo.List(); len(list) != 1 {
		t.Fatalf("List after delete = %d, want 1", len(list))
	}
}
