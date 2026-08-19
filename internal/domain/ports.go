package domain

// EmployeeRepo 는 직원 저장소 Port다.
type EmployeeRepo interface {
	Create(e *Employee) error
	List(activeOnly bool) ([]Employee, error)
	Get(id int64) (*Employee, error)
	Update(e *Employee) error
}

// WorkLogRepo 는 근로기록 저장소 Port다.
type WorkLogRepo interface {
	Create(w *WorkLog) error
	Update(w *WorkLog) error
	// GetOpen 은 해당 직원의 퇴근 처리되지 않은 기록을 반환한다. 없으면 (nil, nil).
	GetOpen(employeeID int64) (*WorkLog, error)
	// List 는 기간(YYYY-MM-DD, 양끝 포함)·직원 필터로 조회한다. employeeID 0이면 전체.
	List(from, to string, employeeID int64) ([]WorkLog, error)
	// ListPending 은 퇴근 완료됐지만 Drive 미동기화된 기록을 반환한다.
	ListPending() ([]WorkLog, error)
	MarkSynced(ids []int64) error
}

// ScheduleRepo 는 스케줄 저장소 Port다.
type ScheduleRepo interface {
	Create(s *ScheduleItem) error
	Update(s *ScheduleItem) error
	Delete(id int64) error
	List() ([]ScheduleItem, error)
}

// TaskScheduler 는 OS 작업 스케줄러 연동 Port다.
type TaskScheduler interface {
	Register(s ScheduleItem) error
	Unregister(taskName string) error
}

// SettingsRepo 는 앱 설정(키-값) 저장소 Port다. 없는 키는 빈 값을 반환한다.
type SettingsRepo interface {
	Get(key string) (string, error)
	Set(key, value string) error
}

// PlaylistRepo 는 재생목록 저장소 Port다.
type PlaylistRepo interface {
	Create(p *PlaylistItem) error
	Update(p *PlaylistItem) error
	Delete(id int64) error
	List(activeOnly bool) ([]PlaylistItem, error)
}

// DrivePort 는 Google Drive/Sheets 연동 Port다.
type DrivePort interface {
	Authorized() bool
	Authorize() error
	// UploadDay 는 하루치 근로기록·체크리스트를 스프레드시트로 업로드하고 URL을 반환한다.
	UploadDay(date string, logs []WorkLog, entries []ChecklistEntry) (string, error)
}

// ChecklistRepo 는 체크리스트 저장소 Port다.
type ChecklistRepo interface {
	CreateTemplate(t *ChecklistTemplate) error
	UpdateTemplate(t *ChecklistTemplate) error
	DeleteTemplate(id int64) error
	ListTemplates(typ string) ([]ChecklistTemplate, error)
	// EnsureEntries 는 해당 일자·구분의 엔트리가 없으면 활성 템플릿으로부터 생성한다.
	EnsureEntries(date, typ string) error
	ListEntries(date, typ string) ([]ChecklistEntry, error)
	SetChecked(entryID int64, checked bool, checkedAt, checkedBy string) error
	// SetPhoto 는 항목의 첨부 사진 경로를 저장한다. 빈 문자열이면 첨부 해제.
	SetPhoto(entryID int64, path string) error
	SaveCompletion(c *ChecklistCompletion) error
	GetCompletion(date, typ string) (*ChecklistCompletion, error)
}
