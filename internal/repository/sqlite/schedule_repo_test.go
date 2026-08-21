package sqlite

import (
	"database/sql"
	"path/filepath"
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

	// 요일 없는 항목 (빈 슬라이스 라운드트립 확인) + 음성 재생 payload
	s2 := &domain.ScheduleItem{TaskName: "마감 30분 전 안내방송", RunTime: "21:30",
		ActionType: domain.ActionPlayAudio, Payload: `C:\HOLMZ\audio\closing_30min.mp3`, Active: true}
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
	if list[1].Payload != `C:\HOLMZ\audio\closing_30min.mp3` {
		t.Errorf("Payload roundtrip = %q", list[1].Payload)
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

// 구버전(payload 컬럼 없는) DB를 열면 마이그레이션으로 컬럼이 추가되어야 한다.
func TestOpenMigratesSchedulesPayload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")
	old, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`CREATE TABLE schedules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_name TEXT NOT NULL, run_time TEXT NOT NULL,
		repeat_days TEXT NOT NULL DEFAULT '', action_type TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1);
		INSERT INTO schedules (task_name, run_time, action_type) VALUES ('기존작업','09:00','upload')`); err != nil {
		t.Fatal(err)
	}
	old.Close()

	db, err := Open(path)
	if err != nil {
		t.Fatalf("Open old db: %v", err)
	}
	defer db.Close()
	list, err := NewScheduleRepo(db).List()
	if err != nil || len(list) != 1 || list[0].TaskName != "기존작업" || list[0].Payload != "" {
		t.Fatalf("migrated list = %+v, err=%v", list, err)
	}
}
