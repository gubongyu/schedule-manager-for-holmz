package sqlite

import (
	"testing"

	"holmz/internal/domain"
)

func TestEmployeeRepoCRUD(t *testing.T) {
	db := openTestDB(t)
	repo := NewEmployeeRepo(db)

	e := &domain.Employee{Name: "김철수", StudentID: "20261234", Department: "컴퓨터공학과", Active: true}
	if err := repo.Create(e); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if e.ID == 0 {
		t.Fatal("Create did not set ID")
	}

	got, err := repo.Get(e.ID)
	if err != nil || got.Name != "김철수" || got.StudentID != "20261234" || got.Department != "컴퓨터공학과" || !got.Active {
		t.Fatalf("Get = %+v, err=%v", got, err)
	}

	e.Department = "소프트웨어학과"
	e.Active = false
	if err := repo.Update(e); err != nil {
		t.Fatalf("Update: %v", err)
	}
	actives, err := repo.List(true)
	if err != nil || len(actives) != 0 {
		t.Fatalf("List(activeOnly) = %v (err=%v), want empty", actives, err)
	}
	all, err := repo.List(false)
	if err != nil || len(all) != 1 || all[0].Department != "소프트웨어학과" {
		t.Fatalf("List(false) = %v (err=%v)", all, err)
	}
}
