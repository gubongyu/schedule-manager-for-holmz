package domain

// 스케줄이 실행하는 자동화 동작 종류 (기획서 6.3 action_type).
const (
	ActionNotifyOpen  = "notify-open"  // 오픈 체크리스트 알림
	ActionNotifyClose = "notify-close" // 마감 체크리스트 알림
	ActionUpload      = "upload"       // 근로기록 Drive 업로드
	ActionPlayStart   = "play-start"   // 영상 재생 시작
	ActionPlayStop    = "play-stop"    // 영상 재생 종료
)

// ScheduleItem 은 Windows 작업 스케줄러에 등록되는 반복 작업 정의다.
type ScheduleItem struct {
	ID         int64    `json:"id"`
	TaskName   string   `json:"taskName"`
	RunTime    string   `json:"runTime"`    // HH:MM
	RepeatDays []string `json:"repeatDays"` // MON,TUE,WED,THU,FRI,SAT,SUN
	ActionType string   `json:"actionType"`
	Active     bool     `json:"active"`
}
