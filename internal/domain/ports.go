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
	SaveCompletion(c *ChecklistCompletion) error
	GetCompletion(date, typ string) (*ChecklistCompletion, error)
}
