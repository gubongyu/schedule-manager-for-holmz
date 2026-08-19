# HOLMZ 외부 연동 (Drive 동기화 · 작업 스케줄러 · YouTube 재생) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기획서 로드맵 3~5단계 — Google Drive/Sheets 자동 동기화, Windows 작업 스케줄러 연동, YouTube 재생+워치독을 MVP 위에 추가한다.

**Architecture:** 기존 헥사고날 구조 유지. 새 Port(`DrivePort`, `TaskScheduler`)와 어댑터(`adapter/googledrive`, `adapter/scheduler`)를 추가하고, `SyncService`/`ScheduleService`/`PlayerService`를 서비스 계층에 추가. OS 의존 어댑터는 주입 가능한 runner/emit 함수로 Linux에서 테스트한다. 스케줄 트리거는 `--action=` CLI 플래그 + Wails SingleInstanceLock으로 실행 중 앱에 전달한다.

**Tech Stack:** golang.org/x/oauth2, google.golang.org/api (drive/v3, sheets/v4), schtasks.exe, YouTube IFrame Player API

**범위 제외 (후속):** 시스템 트레이(Wails v2와 systray 메인루프 충돌 — v3 또는 통합 단계에서), 사진 첨부 UI, PIN 로그인 UI, 토큰 암호화(현재 파일 저장).

---

## Phase A — Google Drive/Sheets 동기화 (Task 1~4)

### Task 1: Port 확장 + WorkLogRepo pending/synced

**Files:** Modify `internal/domain/ports.go`, `internal/repository/sqlite/worklog_repo.go` / Test `worklog_repo_test.go`

- [ ] ports.go에 추가:
```go
// DrivePort 는 Google Drive/Sheets 연동 Port다.
type DrivePort interface {
	Authorized() bool
	Authorize() error
	// UploadDay 는 하루치 근로기록·체크리스트를 스프레드시트로 업로드하고 URL을 반환한다.
	UploadDay(date string, logs []WorkLog, entries []ChecklistEntry) (string, error)
}
```
WorkLogRepo 인터페이스에 `ListPending() ([]WorkLog, error)` (퇴근 완료 + sync_status='pending'), `MarkSynced(ids []int64) error` 추가.
- [ ] 실패 테스트: pending 2건(퇴근완료)+근무중 1건 → ListPending=2; MarkSynced 후 0건, sync_status='synced'.
- [ ] 구현: `WHERE sync_status='pending' AND clock_out != ''`; MarkSynced는 IN절 placeholder 생성.
- [ ] `go test ./...` PASS → commit "feat: add pending/synced tracking to WorkLogRepo and DrivePort"

### Task 2: SyncService

**Files:** Create `internal/service/sync_service.go` / Test `sync_service_test.go`

- [ ] 실패 테스트: fake DrivePort(기록용) + 실제 sqlite repo. 미인증→에러; 2개 날짜 pending → 날짜별 UploadDay 호출·MarkSynced·SyncResult{Uploaded:2, Sheets:[url,url]}; 업로드 실패 시 sync_status 유지.
- [ ] 구현:
```go
type SyncResult struct { Uploaded int `json:"uploaded"`; Sheets []string `json:"sheets"` }
type SyncService struct { worklogs domain.WorkLogRepo; checklists domain.ChecklistRepo; drive domain.DrivePort }
```
`SyncPending()`: ListPending → 날짜별 그룹(정렬) → 각 날짜의 open/close 엔트리 수집 → UploadDay → 성공한 날짜만 MarkSynced.
- [ ] PASS → commit "feat: add SyncService with per-day batch upload"

### Task 3: GoogleDriveAdapter

**Files:** Create `internal/adapter/googledrive/adapter.go` / Test `adapter_test.go`

- [ ] `go get golang.org/x/oauth2 google.golang.org/api`
- [ ] 실패 테스트(Linux 실행 가능 범위): credentials.json 없는 빈 디렉터리 → Authorized()=false, Authorize() 에러 메시지에 "credentials.json" 포함; 유효한 credentials.json+token.json 있으면 Authorized()=true.
- [ ] 구현: configDir에서 credentials.json(google.ConfigFromJSON, drive.file+spreadsheets 스코프)·token.json 로드. Authorize(): 127.0.0.1 루프백 리스너 → openURL(주입) → code 수신 → Exchange → token.json 저장 (3분 타임아웃). UploadDay(): "HOLMZ 근로기록" 폴더 find-or-create → "HOLMZ_<date>" 스프레드시트 find-or-create → Sheet1에 근로기록 표, "체크리스트" 시트 addSheet(이미 있으면 무시) 후 표 기록.
- [ ] PASS → commit "feat: add GoogleDriveAdapter with OAuth loopback flow"

### Task 4: App/Frontend 연동 (설정 화면)

**Files:** Modify `cmd/holmz/app.go`, `cmd/holmz/main.go`, `frontend/dist/*`

- [ ] App에 `GoogleAuthorized() bool`, `GoogleAuthorize() error`, `SyncNow() (*service.SyncResult, error)` 추가. main에서 `googledrive.New(configDir, browser.OpenURL)` + SyncService 조립.
- [ ] Frontend: 설정 화면(관리자) — 연동 상태, [Google 계정 인증], [지금 동기화], credentials.json 위치 안내(%APPDATA%\HOLMZ\credentials.json).
- [ ] Windows 크로스빌드 성공 → commit "feat: wire Drive sync into app and settings screen"

## Phase B — Windows 작업 스케줄러 (Task 5~7)

### Task 5: Schedule 도메인 + Repo

**Files:** Modify `internal/domain/ports.go`, `internal/repository/sqlite/db.go`; Create `internal/domain/schedule.go`, `internal/repository/sqlite/schedule_repo.go` / Test `schedule_repo_test.go`

- [ ] 도메인(기획서 6.3): `ScheduleItem{ID, TaskName, RunTime "HH:MM", RepeatDays []string(MON..SUN), ActionType(notify-open|notify-close|upload|play-start|play-stop), Active}`. Port: `ScheduleRepo{Create,Update,Delete,List}`, `TaskScheduler{Register(ScheduleItem) error; Unregister(taskName string) error}`.
- [ ] schema에 schedules 테이블(repeat_days CSV) 추가. 실패 테스트 → CRUD 구현(List는 run_time, id 정렬; RepeatDays는 strings.Join/Split, 빈 문자열 → 빈 슬라이스) → PASS → commit.

### Task 6: SchtasksAdapter + ScheduleService

**Files:** Create `internal/adapter/scheduler/schtasks.go`(+test), `internal/service/schedule_service.go`(+test)

- [ ] SchtasksAdapter: 주입 runner `func(args ...string)(string,error)` (기본 os/exec schtasks). Register → 기존 삭제(best-effort) 후 `/Create /F /TN HOLMZ\<이름> /TR "<exe>" --action=<type> /SC WEEKLY /D MON,... /ST HH:MM`. Unregister → `/Delete /F /TN` (에러 무시). 테스트: fake runner로 인자 검증.
- [ ] ScheduleService{repo, os TaskScheduler}: Add(활성이면 Register), Update(이전 TaskName Unregister 후 재등록), Delete(Unregister+삭제), Toggle, List, ApplyTemplate(openTime, closeTime) → 오픈 알림/재생 시작(오픈시각), 마감 알림/업로드/재생 종료(마감시각) 5건 생성(매일). 테스트: sqlite repo + fake TaskScheduler 호출 기록 검증.
- [ ] PASS → commit "feat: add schtasks adapter and ScheduleService with templates"

### Task 7: 스케줄 App/Frontend + 트리거 수신

**Files:** Modify `cmd/holmz/app.go`, `cmd/holmz/main.go`, `frontend/dist/*`

- [ ] main: `flag --action` 파싱 → App.startupAction. `options.SingleInstanceLock{UniqueId:"holmz-app"}` + OnSecondInstanceLaunch에서 args의 --action 파싱 → App.HandleAction: "upload"→SyncNow(goroutine), play-start/stop→PlayerService(Phase C), notify-*→EventsEmit("schedule:action"). App: `GetStartupAction()`, `ListSchedules/AddSchedule/UpdateSchedule/DeleteSchedule/ApplyScheduleTemplate`.
- [ ] Frontend: 스케줄 관리 화면(목록·추가·삭제·활성 토글·요일 선택, 템플릿 적용 폼), runtime.EventsOn("schedule:action") → 해당 체크리스트 화면으로 이동+배너. 시작 시 GetStartupAction 반영.
- [ ] Windows 크로스빌드 성공 → commit

## Phase C — YouTube 재생 + 워치독 (Task 8~10)

### Task 8: Playlist 도메인 + Repo

**Files:** `internal/domain/playlist.go`, ports.go, db.go, `internal/repository/sqlite/playlist_repo.go`(+test)

- [ ] 기획서 6.4: `PlaylistItem{ID, SortOrder, Title, VideoURL, VideoID, Active}`; `PlaylistRepo{Create,Update,Delete,List(activeOnly)}`; playlist_items 테이블. TDD로 CRUD → commit.

### Task 9: PlayerService (워치독 포함)

**Files:** `internal/service/player_service.go`(+test)

- [ ] `ParseVideoID(url)`: watch?v=, youtu.be/, /embed/, /shorts/ 패턴, 11자 ID 검증. 테스트 케이스 포함.
- [ ] PlayerService{repo, emit func(string, ...any), clock}: AddVideo(URL 파싱, sortOrder 자동), Remove, List, Start/Stop(재생 기대 상태 + "player:start"/"player:stop" emit), Heartbeat(state) — "error"면 재시도, 정상이면 retries 리셋, CheckStalled() — 재생 중인데 45초 무응답 → "player:reload" emit, 5회 초과 → "player:fatal" + 정지. RunWatchdog(ctx) 15초 틱. IsPlaying().
- [ ] 테스트: 고정 clock 전진 + emit 캡처로 stalled→reload, 연속 오류 6회→fatal, 정상 heartbeat→리셋 검증 → commit.

### Task 10: 재생 화면 (YouTube IFrame) + 대시보드 상태

**Files:** Modify `cmd/holmz/app.go`, `cmd/holmz/main.go`, `frontend/dist/*`

- [ ] App: PlaylistItems/AddPlaylistItem/RemovePlaylistItem/StartPlayback/StopPlayback/PlayerHeartbeat/PlayerStatus. main: emit=runtime.EventsEmit(ctx 가드), OnStartup에서 RunWatchdog 시작, HandleAction의 play-start/play-stop 연결.
- [ ] Frontend 영상 재생 화면: 재생목록 관리(URL 추가/삭제) + YT IFrame API(https://www.youtube.com/iframe_api) 플레이어 — 순환 재생(ENDED→다음), onError→Heartbeat('error'), 10초 주기 heartbeat, 전체화면·음소거·음량. EventsOn: player:reload(현재 영상 재로드), player:start/stop, player:fatal(경고 배너). 대시보드에 재생 상태 표시.
- [ ] `node --check`, Windows 크로스빌드 성공 → commit

### Task 11: 최종 검증 + README 갱신

- [ ] `go vet ./... && go test ./...` 전체 PASS, 크로스빌드 확인.
- [ ] README: Google 연동 설정 절차(credentials.json), 스케줄/재생 사용법, 제한사항(트레이·사진·PIN 후속) 추가 → commit.

## Self-Review
- 기획서 3.1(Drive 업로드·배치), 3.2(스케줄 등록·템플릿·트리거), 3.3(재생·워치독·음량), 8장 플로우(오픈/마감 자동화) 커버. UAC 매니페스트·절전 깨우기 옵션은 Windows 실기 검증 필요 항목으로 README에 기재.
- 타입 일관성: DrivePort/TaskScheduler 시그니처가 Task 2/6 서비스 사용처와 일치. ActionType 문자열 5종은 Task 6 템플릿·Task 7 HandleAction·Task 10 프론트에서 동일 상수 사용.
