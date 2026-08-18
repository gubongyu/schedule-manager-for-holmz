package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestEmployeeRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewEmployeeRepo(db)

	e := &domain.Employee{Name: "김철수", PIN: "1234", Active: true}
	if err := repo.Create(e); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if e.ID == 0 {
		t.Fatal("Create did not set ID")
	}

	got, err := repo.Get(e.ID)
	if err != nil || got.Name != "김철수" || got.PIN != "1234" || !got.Active {
		t.Fatalf("Get = %+v, err=%v", got, err)
	}

	e.Active = false
	if err := repo.Update(e); err != nil {
		t.Fatalf("Update: %v", err)
	}
	actives, err := repo.List(true)
	if err != nil || len(actives) != 0 {
		t.Fatalf("List(activeOnly) = %v (err=%v), want empty", actives, err)
	}
	all, err := repo.List(false)
	if err != nil || len(all) != 1 {
		t.Fatalf("List(false) = %v (err=%v), want 1", all, err)
	}
}
