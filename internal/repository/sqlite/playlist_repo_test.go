package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestPlaylistRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewPlaylistRepo(db)

	p1 := &domain.PlaylistItem{SortOrder: 2, Title: "영상2", VideoURL: "https://youtu.be/bbbbbbbbbbb", VideoID: "bbbbbbbbbbb", Active: true}
	p2 := &domain.PlaylistItem{SortOrder: 1, Title: "영상1", VideoURL: "https://youtu.be/aaaaaaaaaaa", VideoID: "aaaaaaaaaaa", Active: true}
	for _, p := range []*domain.PlaylistItem{p1, p2} {
		if err := repo.Create(p); err != nil {
			t.Fatalf("Create: %v", err)
		}
		if p.ID == 0 {
			t.Fatal("Create did not set ID")
		}
	}

	list, err := repo.List(true)
	if err != nil || len(list) != 2 || list[0].VideoID != "aaaaaaaaaaa" {
		t.Fatalf("List = %+v (err=%v), want sorted by sort_order", list, err)
	}

	p1.Active = false
	if err := repo.Update(p1); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if actives, _ := repo.List(true); len(actives) != 1 {
		t.Errorf("List(activeOnly) = %d, want 1", len(actives))
	}
	if all, _ := repo.List(false); len(all) != 2 {
		t.Errorf("List(false) = %d, want 2", len(all))
	}

	if err := repo.Delete(p2.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if all, _ := repo.List(false); len(all) != 1 {
		t.Errorf("after delete = %d, want 1", len(all))
	}
}
