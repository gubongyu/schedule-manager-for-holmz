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

// AudioRepeater 는 같은 안내 음성을 연속으로 재생하도록 준비한다.
// 스케줄러에 넘길 재생 대상(재생목록 등)을 만들어 주며, 파일 형식은 어댑터가 정한다.
type AudioRepeater interface {
	// Repeat 는 audioPath 를 count 회 이어서 재생할 대상 경로를 만들어 반환한다.
	Repeat(id int64, audioPath string, count int) (string, error)
	// Discard 는 준비물을 정리한다 (없으면 무시).
	Discard(id int64) error
}

// TaskScheduler 는 OS 작업 스케줄러 연동 Port다.
type TaskScheduler interface {
	Register(s ScheduleItem) error
	Unregister(taskName string) error
}

// ShiftRepo 는 근로 스케줄(주간 근무 배치) 저장소 Port다.
type ShiftRepo interface {
	Create(s *Shift) error
	Update(s *Shift) error
	Delete(id int64) error
	// List 는 직원 이름을 채워 전체 배치를 반환한다.
	List() ([]Shift, error)
}

// ShiftOverrideRepo 는 날짜별 근무 예외(휴가/대타) 저장소 Port다.
type ShiftOverrideRepo interface {
	Create(o *ShiftOverride) error
	Delete(id int64) error
	// ListRange 는 기간(YYYY-MM-DD, 양끝 포함)의 예외를 직원 이름과 함께 반환한다.
	ListRange(from, to string) ([]ShiftOverride, error)
}

// RentalRepo 는 HDMI 대여 기록 저장소 Port다.
type RentalRepo interface {
	Create(r *Rental) error
	Update(r *Rental) error
	Delete(id int64) error
	// List 는 최근 기록부터 반환한다.
	List() ([]Rental, error)
}

// LostItemRepo 는 분실물(습득·접수) 기록 저장소 Port다.
type LostItemRepo interface {
	Create(l *LostItem) error
	Update(l *LostItem) error
	Delete(id int64) error
	// List 는 유형(found|reported)별로 최근 기록부터 반환한다. typ 이 빈 문자열이면 전체.
	List(typ string) ([]LostItem, error)
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
	// UploadMaster 는 직원 명단·근무 스케줄·예외를 기준정보 스프레드시트로 업로드하고 URL을 반환한다.
	UploadMaster(employees []Employee, shifts []Shift, overrides []ShiftOverride) (string, error)
	// UploadDesk 는 데스크 업무(HDMI 대여·분실물)를 전용 스프레드시트로 업로드하고 URL을 반환한다.
	UploadDesk(rentals []Rental, lostItems []LostItem) (string, error)
}

// ReleaseSource 는 새 버전 정보를 가져오는 Port다 (GitHub Releases 등).
type ReleaseSource interface {
	// Latest 는 최신 릴리스를 반환한다. 릴리스가 하나도 없으면 (nil, nil).
	Latest() (*Release, error)
	// Download 는 실행 파일을 dst 경로에 내려받는다.
	Download(url, dst string) error
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
