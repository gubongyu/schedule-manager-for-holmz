package service

import (
	"errors"
	"path/filepath"
	"testing"

	"holmz/internal/domain"
	"holmz/internal/repository/sqlite"
)

type fakeDrive struct {
	authorized      bool
	uploadErr       error
	uploads         []string // 호출된 date 기록
	masterEmployees []domain.Employee
	masterShifts    []domain.Shift
	deskCalls       int
	masterCalls     int
}

func (f *fakeDrive) Authorized() bool { return f.authorized }
func (f *fakeDrive) Authorize() error { f.authorized = true; return nil }
func (f *fakeDrive) UploadMaster(employees []domain.Employee, shifts []domain.Shift, overrides []domain.ShiftOverride) (string, error) {
	if f.uploadErr != nil {
		return "", f.uploadErr
	}
	f.masterEmployees, f.masterShifts = employees, shifts
	f.masterCalls++
	return "https://sheets.example/master", nil
}

func (f *fakeDrive) UploadDesk(rentals []domain.Rental, items []domain.LostItem) (string, error) {
	if f.uploadErr != nil {
		return "", f.uploadErr
	}
	f.deskCalls++
	return "https://sheets.example/desk", nil
}

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
	if _, err := sqlite.NewShiftRepo(db).List(); err != nil {
		t.Fatal(err)
	}
	svc := NewSyncService(wl, sqlite.NewChecklistRepo(db), drive,
		sqlite.NewEmployeeRepo(db), sqlite.NewShiftRepo(db), sqlite.NewShiftOverrideRepo(db),
		sqlite.NewRentalRepo(db), sqlite.NewLostItemRepo(db), nil)
	return svc, wl
}

// 근로기록이 0건이어도 직원·스케줄 기준정보는 항상 동기화되어야 한다.
func TestSyncUploadsMasterEvenWithoutPendingLogs(t *testing.T) {
	drive := &fakeDrive{authorized: true}
	svc, wl := setupSync(t, drive)
	if _, err := svc.SyncPending(); err != nil { // 1차: pending 2건 처리
		t.Fatal(err)
	}
	res, err := svc.SyncPending() // 2차: pending 0건
	if err != nil {
		t.Fatalf("SyncPending: %v", err)
	}
	if res.Uploaded != 0 || drive.masterCalls != 2 {
		t.Errorf("uploaded=%d masterCalls=%d, want 0/2", res.Uploaded, drive.masterCalls)
	}
	if res.Master != "https://sheets.example/master" {
		t.Errorf("Master URL = %q", res.Master)
	}
	if len(drive.masterEmployees) != 1 || drive.masterEmployees[0].Name != "A" {
		t.Errorf("master employees = %+v", drive.masterEmployees)
	}
	if pending, _ := wl.ListPending(); len(pending) != 0 {
		t.Errorf("pending = %d", len(pending))
	}
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

// 꺼둔 항목은 업로드하지 않고, 켜둔 항목만 올라가야 한다.
func TestSyncSkipsDisabledTargets(t *testing.T) {
	drive := &fakeDrive{authorized: true}
	svc, _ := setupSync(t, drive)
	svc.SetTargetsProvider(func() SyncTargets { return SyncTargets{Worklog: true} })
	res, err := svc.SyncPending()
	if err != nil {
		t.Fatalf("SyncPending: %v", err)
	}
	if res.Uploaded != 2 {
		t.Errorf("uploaded=%d, want 2", res.Uploaded)
	}
	if drive.masterCalls != 0 || drive.deskCalls != 0 {
		t.Errorf("master=%d desk=%d, want 0/0", drive.masterCalls, drive.deskCalls)
	}
	if res.Master != "" || res.Desk != "" {
		t.Errorf("URL이 남았다: master=%q desk=%q", res.Master, res.Desk)
	}
}

// 근로기록만 꺼도 기준정보·데스크 시트는 계속 갱신되어야 한다.
func TestSyncWorklogDisabledKeepsOthers(t *testing.T) {
	drive := &fakeDrive{authorized: true}
	svc, _ := setupSync(t, drive)
	svc.SetTargetsProvider(func() SyncTargets { return SyncTargets{Master: true, Desk: true} })
	res, err := svc.SyncPending()
	if err != nil {
		t.Fatalf("SyncPending: %v", err)
	}
	if res.Uploaded != 0 || len(drive.uploads) != 0 {
		t.Errorf("근로기록이 업로드되었다: %d건", res.Uploaded)
	}
	if drive.masterCalls != 1 || drive.deskCalls != 1 {
		t.Errorf("master=%d desk=%d, want 1/1", drive.masterCalls, drive.deskCalls)
	}
}
