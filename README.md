# HOLMZ 근로 종합 관리 프로그램

매장·카페 운영을 위한 Windows 데스크톱 앱. 근로기록(출퇴근/업무), 오픈·마감 체크리스트를 로컬 SQLite에 저장한다. (MVP — Google Drive 동기화, 작업 스케줄러, YouTube 재생은 후속 단계)

## 빌드 (WSL/Linux에서 Windows용 크로스컴파일)

    GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags desktop,production -ldflags "-w -s -H windowsgui" -o build/holmz.exe ./cmd/holmz

- 산출물: `build/holmz.exe` 단일 실행 파일
- 실행 요건: Windows 10/11 + Microsoft Edge WebView2 Runtime (최신 Windows에 기본 내장)
- 데이터 저장 위치: `%APPDATA%\HOLMZ\holmz.db`

## 테스트

    go test ./...

## 구조

기획서(`HOLMZ_기획서_및_아키텍처.md`) 13장 헥사고날 아키텍처를 따른다.

- `cmd/holmz` — Wails 부트스트랩 + App 파사드
- `internal/domain` — 엔티티 + Port 인터페이스
- `internal/service` — 유스케이스 (WorkLogService, ChecklistService)
- `internal/repository/sqlite` — Pure Go SQLite 어댑터
- `frontend/dist` — 정적 UI (go:embed)
