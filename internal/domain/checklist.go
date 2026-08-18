package domain

// ChecklistTemplate 은 관리자가 등록하는 오픈/마감 점검 항목 정의다.
type ChecklistTemplate struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"` // open | close
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	Required  bool   `json:"required"`
	Active    bool   `json:"active"`
}

// ChecklistEntry 는 특정 일자에 대해 템플릿으로부터 생성된 점검 기록이다.
type ChecklistEntry struct {
	ID         int64  `json:"id"`
	Date       string `json:"date"` // YYYY-MM-DD
	TemplateID int64  `json:"templateId"`
	Type       string `json:"type"`
	Name       string `json:"name"`
	Required   bool   `json:"required"`
	Checked    bool   `json:"checked"`
	CheckedAt  string `json:"checkedAt"` // RFC3339
	CheckedBy  string `json:"checkedBy"`
	PhotoPath  string `json:"photoPath"`
}

// ChecklistCompletion 은 일자별 오픈/마감 완료 처리 기록이다.
type ChecklistCompletion struct {
	Date        string `json:"date"`
	Type        string `json:"type"`
	CompletedAt string `json:"completedAt"`
	CompletedBy string `json:"completedBy"`
}
