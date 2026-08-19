package service

import (
	"errors"
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

type fakeDrive struct {
	authorized bool
	uploadErr  error
	uploads    []string // 호출된 date 기록
}

func (f *fakeDrive) Authorized() bool { return f.authorized }
func (f *fakeDrive) Authorize() error { f.authorized = true; return nil }
func (f *fakeDrive) UploadDay(date string, logs []domain.WorkLog, entries []domain.ChecklistEntry) (string, error) {
	if f.uploadErr != nil {
		return "", f.uploadErr
	}
	f.uploads = append(f.uploads, date)
	return "https://sheets.example/" + date, nil
}

func setupSync(t *testing.T, drive domain.DrivePort) (*SyncService, *sqlite.WorkLogRepo) {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	emp := &domain.Employee{Name: "A", Active: true}
	if err := sqlite.NewEmployeeRepo(db).Create(emp); err != nil {
		t.Fatal(err)
	}
	wl := sqlite.NewWorkLogRepo(db)
	for _, date := range []string{"2026-08-17", "2026-08-18"} {
		w := &domain.WorkLog{EmployeeID: emp.ID, Date: date, ClockIn: date + "T09:00:00+09:00",
			ClockOut: date + "T18:00:00+09:00", SyncStatus: "pending"}
		if err := wl.Create(w); err != nil {
			t.Fatal(err)
		}
	}
	return NewSyncService(wl, sqlite.NewChecklistRepo(db), drive), wl
}

func TestSyncPendingNotAuthorized(t *testing.T) {
	svc, _ := setupSync(t, &fakeDrive{authorized: false})
	if _, err := svc.SyncPending(); !errors.Is(err, ErrNotAuthorized) {
		t.Fatalf("err = %v, want ErrNotAuthorized", err)
	}
}

func TestSyncPendingUploadsPerDay(t *testing.T) {
	drive := &fakeDrive{authorized: true}
	svc, wl := setupSync(t, drive)

	res, err := svc.SyncPending()
	if err != nil {
		t.Fatalf("SyncPending: %v", err)
	}
	if res.Uploaded != 2 || len(res.Sheets) != 2 {
		t.Errorf("result = %+v, want 2 uploaded / 2 sheets", res)
	}
	if len(drive.uploads) != 2 || drive.uploads[0] != "2026-08-17" || drive.uploads[1] != "2026-08-18" {
		t.Errorf("uploads = %v, want sorted dates", drive.uploads)
	}
	if pending, _ := wl.ListPending(); len(pending) != 0 {
		t.Errorf("pending after sync = %d, want 0", len(pending))
	}
}

func TestSyncPendingUploadFailureKeepsPending(t *testing.T) {
	drive := &fakeDrive{authorized: true, uploadErr: errors.New("network down")}
	svc, wl := setupSync(t, drive)

	if _, err := svc.SyncPending(); err == nil {
		t.Fatal("SyncPending should propagate upload error")
	}
	if pending, _ := wl.ListPending(); len(pending) != 2 {
		t.Errorf("pending after failure = %d, want 2 (unchanged)", len(pending))
	}
}
