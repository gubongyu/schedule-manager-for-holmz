package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestChecklistTemplateCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewChecklistRepo(db)

	tpl := &domain.ChecklistTemplate{Type: "open", Name: "조명 점등", SortOrder: 1, Required: true, Active: true}
	if err := repo.CreateTemplate(tpl); err != nil {
		t.Fatalf("CreateTemplate: %v", err)
	}
	if tpl.ID == 0 {
		t.Fatal("CreateTemplate did not set ID")
	}

	tpl.Name = "매장 조명·간판 점등"
	if err := repo.UpdateTemplate(tpl); err != nil {
		t.Fatalf("UpdateTemplate: %v", err)
	}
	list, err := repo.ListTemplates("open")
	if err != nil || len(list) != 1 || list[0].Name != "매장 조명·간판 점등" {
		t.Fatalf("ListTemplates = %+v, err=%v", list, err)
	}

	if err := repo.DeleteTemplate(tpl.ID); err != nil {
		t.Fatalf("DeleteTemplate: %v", err)
	}
	list, _ = repo.ListTemplates("open")
	if len(list) != 0 {
		t.Fatalf("ListTemplates after delete = %+v, want empty", list)
	}
}

func TestChecklistEntriesLifecycle(t *testing.T) {
	db := openTestDB(t)
	repo := NewChecklistRepo(db)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "조명", SortOrder: 1, Required: true, Active: true}))
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "테이블 정리", SortOrder: 2, Active: true}))
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "비활성 항목", SortOrder: 3, Active: false}))
	must(repo.CreateTemplate(&domain.ChecklistTemplate{Type: "close", Name: "소등", SortOrder: 1, Required: true, Active: true}))

	must(repo.EnsureEntries("2026-08-19", "open"))
	must(repo.EnsureEntries("2026-08-19", "open")) // 멱등이어야 한다
	entries, err := repo.ListEntries("2026-08-19", "open")
	if err != nil || len(entries) != 2 {
		t.Fatalf("ListEntries = %d (err=%v), want 2 (active only, idempotent)", len(entries), err)
	}
	if entries[0].Name != "조명" || !entries[0].Required {
		t.Errorf("entries[0] = %+v, want 조명/required", entries[0])
	}

	must(repo.SetChecked(entries[0].ID, true, "2026-08-19T09:05:00+09:00", "김철수"))
	entries, _ = repo.ListEntries("2026-08-19", "open")
	if !entries[0].Checked || entries[0].CheckedBy != "김철수" {
		t.Errorf("after SetChecked: %+v", entries[0])
	}

	if c, err := repo.GetCompletion("2026-08-19", "open"); err != nil || c != nil {
		t.Fatalf("GetCompletion before save = %+v, err=%v, want nil,nil", c, err)
	}
	must(repo.SaveCompletion(&domain.ChecklistCompletion{Date: "2026-08-19", Type: "open",
		CompletedAt: "2026-08-19T09:30:00+09:00", CompletedBy: "김철수"}))
	c, err := repo.GetCompletion("2026-08-19", "open")
	if err != nil || c == nil || c.CompletedBy != "김철수" {
		t.Fatalf("GetCompletion = %+v, err=%v", c, err)
	}
}

func TestChecklistSetPhoto(t *testing.T) {
	db := openTestDB(t)
	repo := NewChecklistRepo(db)
	if err := repo.CreateTemplate(&domain.ChecklistTemplate{Type: "open", Name: "청소", SortOrder: 1, Active: true}); err != nil {
		t.Fatal(err)
	}
	if err := repo.EnsureEntries("2026-08-19", "open"); err != nil {
		t.Fatal(err)
	}
	entries, _ := repo.ListEntries("2026-08-19", "open")

	if err := repo.SetPhoto(entries[0].ID, `C:\photos\entry_1.jpg`); err != nil {
		t.Fatalf("SetPhoto: %v", err)
	}
	entries, _ = repo.ListEntries("2026-08-19", "open")
	if entries[0].PhotoPath != `C:\photos\entry_1.jpg` {
		t.Errorf("PhotoPath = %q", entries[0].PhotoPath)
	}

	if err := repo.SetPhoto(entries[0].ID, ""); err != nil {
		t.Fatalf("SetPhoto clear: %v", err)
	}
	entries, _ = repo.ListEntries("2026-08-19", "open")
	if entries[0].PhotoPath != "" {
		t.Errorf("PhotoPath after clear = %q, want empty", entries[0].PhotoPath)
	}
}
