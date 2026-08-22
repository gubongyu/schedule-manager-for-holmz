# HOLMZ 근로 종합 관리 프로그램

매장·카페 운영을 위한 Windows 데스크톱 앱. 기획서의 4대 기능을 구현한다:

1. **근로기록** — 출퇴근 버튼, 업무 노트, 직원별·기간별 조회
2. **오픈·마감 체크리스트** — 항목 관리, 필수 항목 미완료 시 완료 처리 차단, 항목별 사진 첨부
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
   (발급된 OAuth 토큰은 Windows DPAPI로 암호화되어 `%APPDATA%\HOLMZ\token.enc` 에 저장된다. 구버전 평문 `token.json` 은 최초 실행 시 자동 이전·삭제)
5. 이후 [지금 동기화] 또는 마감 스케줄의 "근로기록 업로드"가 자동 실행됨 — 결과는 Drive의 "HOLMZ 근로기록" 폴더에 일자별 시트로 저장

## 작업 스케줄러

**스케줄 관리** 화면에서 오픈/마감 시각을 입력하고 [템플릿 적용]을 누르면 기획서 3.2의 대표 자동화 5건(오픈 알림·재생 시작 / 마감 알림·업로드·재생 종료)이 Windows 작업 스케줄러(`HOLMZ\` 폴더)에 등록된다. 등록에는 관리자 권한(UAC)이 필요할 수 있다. 트리거 시 앱이 `--action=<동작>` 인자로 호출되고, 이미 실행 중이면 SingleInstanceLock을 통해 기존 창에 전달된다.

## YouTube 재생

**영상 재생** 화면에서 영상 URL을 재생목록에 추가하고 재생을 시작한다. 순환 재생·전체화면·음소거·음량을 지원하며, 오류나 45초 이상 무응답 시 워치독이 자동 재시작한다(5회 초과 시 경고 표시). ※ 상업 공간에서의 YouTube 상시 재생은 약관 제한이 있을 수 있으니 자체 콘텐츠 또는 라이선스 확보 후 사용 권장 (기획서 11장).

## PIN 인증

- **근무자 본인 확인(학번)**: 직원은 이름·학번·학과로 등록하며, 학번이 등록된 직원은 출퇴근·업무기록·체크리스트 작성 시 학번 입력으로 본인 확인을 요구한다 (세션당 1회). 학번은 관리자 화면에 표시되는 식별 정보라 평문으로 저장·비교한다.
- **관리자 PIN**: 설정 화면에서 등록하면 관리자 메뉴 진입 시 PIN을 요구한다. 비워서 저장하면 잠금 해제. bcrypt 해시로 저장된다.

## 사진 첨부

체크리스트 항목의 [📷 사진] 버튼으로 이미지를 첨부한다(청소 상태·재고 확인 등). 파일은 `%APPDATA%\HOLMZ\photos\`에 복사 저장되고, Drive 업로드 시트의 "첨부사진" 열에 경로가 기록된다.

## 시스템 트레이 상주

창을 닫아도 종료되지 않고 트레이 아이콘으로 상주한다. 트레이 메뉴: **HOLMZ 열기**(창 표시) / **지금 동기화**(Drive 업로드) / **종료**(완전 종료). 스케줄 트리거가 오면 숨겨진 창이 자동으로 표시된다.

## 테스트

    go test ./...

## 구조

기획서(`HOLMZ_기획서_및_아키텍처.md`) 13장 헥사고날 아키텍처를 따른다.

- `cmd/holmz` — Wails 부트스트랩 + App 파사드 (+ `--action` 트리거, 시스템 트레이)
- `internal/domain` — 엔티티 + Port 인터페이스
- `internal/service` — WorkLog / Checklist / Sync / Schedule / Player 서비스
- `internal/repository/sqlite` — Pure Go SQLite 어댑터
- `internal/adapter/googledrive` — Drive/Sheets OAuth 어댑터
- `internal/adapter/scheduler` — schtasks.exe 어댑터
- `frontend/dist` — 정적 UI (go:embed)

## 제한사항 / 남은 작업

- credentials.json(OAuth 클라이언트 구성)은 평문 유지 — 데스크톱 앱 클라이언트 특성상 비밀로 취급되지 않는 값이나, 필요 시 파일 권한으로 보호할 것
- 절전 모드 깨우기(`WakeToRun`)는 schtasks CLI로 설정 불가 — 필요 시 작업 스케줄러 GUI에서 해당 작업의 "이 작업을 실행하기 위해 절전 모드 종료" 옵션을 켤 것
- Windows 실기에서 UAC·스케줄 트리거·재생 화면 동작 검증 필요 (WSL에서는 GUI 실행 불가)
