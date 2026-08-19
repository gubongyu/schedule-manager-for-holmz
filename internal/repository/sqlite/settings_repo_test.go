package sqlite

import "testing"

func TestSettingsRepoGetSet(t *testing.T) {
	db := openTestDB(t)
	repo := NewSettingsRepo(db)

	// 없는 키는 빈 값, 에러 아님
	if v, err := repo.Get("admin_pin"); err != nil || v != "" {
		t.Fatalf("Get missing = %q, err=%v; want empty, nil", v, err)
	}

	if err := repo.Set("admin_pin", "9999"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if v, _ := repo.Get("admin_pin"); v != "9999" {
		t.Errorf("Get = %q, want 9999", v)
	}

	// 덮어쓰기
	if err := repo.Set("admin_pin", "1111"); err != nil {
		t.Fatalf("Set overwrite: %v", err)
	}
	if v, _ := repo.Get("admin_pin"); v != "1111" {
		t.Errorf("Get after overwrite = %q, want 1111", v)
	}
}
