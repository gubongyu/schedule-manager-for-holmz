# HOLMZ 근로 종합 관리 프로그램

매장·카페 운영을 위한 Windows 데스크톱 앱. 기획서의 4대 기능을 구현한다:

1. **근로기록** — 출퇴근 버튼, 업무 노트, 직원별·기간별 조회
2. **오픈·마감 체크리스트** — 항목 관리, 필수 항목 미완료 시 완료 처리 차단
3. **Google Drive 동기화** — 퇴근 완료 기록을 일자별 스프레드시트로 배치 업로드
4. **Windows 작업 스케줄러 + YouTube 재생** — 오픈/마감 자동화 템플릿, 24시간 반복 재생 + 워치독 자동 복구

## 빌드 (WSL/Linux에서 Windows용 크로스컴파일)

    GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags desktop,production -ldflags "-w -s -H windowsgui" -o build/holmz.exe ./cmd/holmz

- 산출물: `build/holmz.exe` 단일 실행 파일
- 실행 요건: Windows 10/11 + Microsoft Edge WebView2 Runtime (최신 Windows에 기본 내장)
- 데이터 저장 위치: `%APPDATA%\HOLMZ\holmz.db`

## Google 연동 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성 → Drive API·Sheets API 활성화
2. OAuth 동의 화면 구성 후 **"데스크톱 앱" OAuth 클라이언트 ID** 생성
3. 내려받은 JSON을 `%APPDATA%\HOLMZ\credentials.json` 으로 저장
4. 앱의 **설정 (Google 연동)** 화면에서 [Google 계정 인증] 클릭 → 브라우저에서 승인
5. 이후 [지금 동기화] 또는 마감 스케줄의 "근로기록 업로드"가 자동 실행됨 — 결과는 Drive의 "HOLMZ 근로기록" 폴더에 일자별 시트로 저장

## 작업 스케줄러

**스케줄 관리** 화면에서 오픈/마감 시각을 입력하고 [템플릿 적용]을 누르면 기획서 3.2의 대표 자동화 5건(오픈 알림·재생 시작 / 마감 알림·업로드·재생 종료)이 Windows 작업 스케줄러(`HOLMZ\` 폴더)에 등록된다. 등록에는 관리자 권한(UAC)이 필요할 수 있다. 트리거 시 앱이 `--action=<동작>` 인자로 호출되고, 이미 실행 중이면 SingleInstanceLock을 통해 기존 창에 전달된다.

## YouTube 재생

**영상 재생** 화면에서 영상 URL을 재생목록에 추가하고 재생을 시작한다. 순환 재생·전체화면·음소거·음량을 지원하며, 오류나 45초 이상 무응답 시 워치독이 자동 재시작한다(5회 초과 시 경고 표시). ※ 상업 공간에서의 YouTube 상시 재생은 약관 제한이 있을 수 있으니 자체 콘텐츠 또는 라이선스 확보 후 사용 권장 (기획서 11장).

## 테스트

    go test ./...

## 구조

기획서(`HOLMZ_기획서_및_아키텍처.md`) 13장 헥사고날 아키텍처를 따른다.

- `cmd/holmz` — Wails 부트스트랩 + App 파사드 (+ `--action` 트리거 처리)
- `internal/domain` — 엔티티 + Port 인터페이스
- `internal/service` — WorkLog / Checklist / Sync / Schedule / Player 서비스
- `internal/repository/sqlite` — Pure Go SQLite 어댑터
- `internal/adapter/googledrive` — Drive/Sheets OAuth 어댑터
- `internal/adapter/scheduler` — schtasks.exe 어댑터
- `frontend/dist` — 정적 UI (go:embed)

## 제한사항 / 남은 작업

- 시스템 트레이 상주(Wails v2 미지원 — v3 이전 시 도입), 체크리스트 사진 첨부 UI, 직원 PIN 로그인 UI (DB 필드는 준비됨)
- OAuth 토큰은 `%APPDATA%\HOLMZ\token.json` 평문 저장 — Credential Manager 연동은 후속 보안 강화 항목
- 절전 모드 깨우기(`WakeToRun`)는 schtasks CLI로 설정 불가 — 필요 시 작업 스케줄러 GUI에서 해당 작업의 "이 작업을 실행하기 위해 절전 모드 종료" 옵션을 켤 것
- Windows 실기에서 UAC·스케줄 트리거·재생 화면 동작 검증 필요 (WSL에서는 GUI 실행 불가)
