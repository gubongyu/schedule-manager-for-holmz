package service

import (
	"path/filepath"
	"testing"
	"time"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

func setupChecklist(t *testing.T, clock func() time.Time) *ChecklistService {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	repo := sqlite.NewChecklistRepo(db)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "조명 점등", SortOrder: 1, Required: true, Active: true}))
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "테이블 정리", SortOrder: 2, Active: true}))
	return NewChecklistService(repo, clock)
}

func TestTodayCreatesEntries(t *testing.T) {
	svc := setupChecklist(t, fixedClock("2026-08-19T09:00:00+09:00"))
	view, err := svc.Today("open")
	if err != nil {
		t.Fatalf("Today: %v", err)
	}
	if len(view.Entries) != 2 || view.Date != "2026-08-19" || view.Completed {
		t.Fatalf("Today view = %+v", view)
	}
}

func TestCheckAndComplete(t *testing.T) {
	svc := setupChecklist(t, fixedClock("2026-08-19T09:00:00+09:00"))
	view, err := svc.Today("open")
	if err != nil {
		t.Fatal(err)
	}

	// 필수 항목 미체크 상태에서 완료 시도 → 실패
	if err := svc.Complete("open", "김철수"); err == nil {
		t.Fatal("Complete with unchecked required item should fail")
	}

	// 필수 항목(조명 점등)만 체크 후 완료 → 성공 (선택 항목은 미체크여도 됨)
	if err := svc.Check(view.Entries[0].ID, true, "김철수"); err != nil {
		t.Fatalf("Check: %v", err)
	}
	if err := svc.Complete("open", "김철수"); err != nil {
		t.Fatalf("Complete: %v", err)
	}

	view, err = svc.Today("open")
	if err != nil {
		t.Fatal(err)
	}
	if !view.Completed || view.CompletedBy != "김철수" {
		t.Errorf("view after complete = %+v", view)
	}
	if !view.Entries[0].Checked || view.Entries[0].CheckedBy != "김철수" ||
		view.Entries[0].CheckedAt != "2026-08-19T09:00:00+09:00" {
		t.Errorf("entry after check = %+v", view.Entries[0])
	}
}

func TestTemplateManagement(t *testing.T) {
	svc := setupChecklist(t, fixedClock("2026-08-19T09:00:00+09:00"))
	tpl, err := svc.AddTemplate("close", "소등", 1, true)
	if err != nil || tpl.ID == 0 {
		t.Fatalf("AddTemplate = %+v, err=%v", tpl, err)
	}
	tpl.Name = "매장 소등"
	if err := svc.UpdateTemplate(tpl); err != nil {
		t.Fatalf("UpdateTemplate: %v", err)
	}
	list, err := svc.Templates("close")
	if err != nil || len(list) != 1 || list[0].Name != "매장 소등" {
		t.Fatalf("Templates = %+v, err=%v", list, err)
	}
	if err := svc.RemoveTemplate(tpl.ID); err != nil {
		t.Fatalf("RemoveTemplate: %v", err)
	}
}
