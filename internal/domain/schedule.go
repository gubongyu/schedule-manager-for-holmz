package domain

// 스케줄이 실행하는 자동화 동작 종류 (기획서 6.3 action_type).
const (
	ActionNotifyOpen  = "notify-open"  // 오픈 체크리스트 알림
	ActionNotifyClose = "notify-close" // 마감 체크리스트 알림
	ActionUpload      = "upload"       // 근로기록 Drive 업로드
	ActionPlayStart   = "play-start"   // 영상 재생 시작
	ActionPlayStop    = "play-stop"    // 영상 재생 종료
	ActionPlayAudio   = "play-audio"   // 지정 음성 파일 재생 (안내방송)
)

// ScheduleItem 은 Windows 작업 스케줄러에 등록되는 반복 작업 정의다.
type ScheduleItem struct {
	ID         int64    `json:"id"`
	TaskName   string   `json:"taskName"`
	RunTime    string   `json:"runTime"`    // HH:MM
	RepeatDays []string `json:"repeatDays"` // MON,TUE,WED,THU,FRI,SAT,SUN
	ActionType string   `json:"actionType"`
	// Payload 는 동작별 부가 데이터다. play-audio: 재생할 음성 파일 경로.
	Payload string `json:"payload"`
	// Repeat 는 play-audio의 연속 재생 횟수다 (기본 1, 최대 5).
	Repeat int  `json:"repeat"`
	Active bool `json:"active"`
}
