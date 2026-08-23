// Package googledrive 는 domain.DrivePort 의 Google Drive/Sheets API 구현이다.
//
// 인증 준비물: Google Cloud Console에서 "데스크톱 앱" OAuth 클라이언트를 만들어
// credentials.json 을 설정 디렉터리(%APPDATA%\HOLMZ)에 두면 된다. 토큰은 같은
// 디렉터리의 token.json 에 저장된다.
package googledrive

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	"holmz/internal/adapter/secret"
	"holmz/internal/domain"
)

const folderName = "HOLMZ 근로기록"

// authTimeout 은 브라우저 인증 응답 대기 한도다 (테스트에서 단축을 위해 변수).
var authTimeout = 3 * time.Minute

type Adapter struct {
	configDir string
	openURL   func(string) error
	sealer    secret.Sealer

	mu     sync.Mutex // config/token 접근 보호 (짧게만 잡는다)
	config *oauth2.Config
	token  *oauth2.Token

	authBusy atomic.Bool // 인증 중복 실행 방지
}

// New 는 설정 디렉터리의 credentials.json 과 암호화 토큰(token.enc)을 로드해 어댑터를 만든다.
// 토큰은 Windows DPAPI(비Windows는 AES-GCM)로 암호화 저장된다. 구버전 평문 token.json 이
// 발견되면 암호화 파일로 이전하고 평문을 삭제한다.
// openURL 은 인증 시 브라우저를 여는 함수다 (nil이면 Authorize에서 에러).
func New(configDir string, openURL func(string) error) *Adapter {
	a := &Adapter{configDir: configDir, openURL: openURL}
	a.sealer, _ = secret.New(configDir)
	a.config, _ = a.loadConfig()
	a.token, _ = a.loadToken()
	return a
}

func (a *Adapter) loadConfig() (*oauth2.Config, error) {
	b, err := os.ReadFile(filepath.Join(a.configDir, "credentials.json"))
	if err != nil {
		return nil, fmt.Errorf("credentials.json 을 읽을 수 없습니다 (%s): %w", a.configDir, err)
	}
	return google.ConfigFromJSON(b, drive.DriveFileScope, sheets.SpreadsheetsScope)
}

func (a *Adapter) loadToken() (*oauth2.Token, error) {
	encPath := filepath.Join(a.configDir, "token.enc")
	legacyPath := filepath.Join(a.configDir, "token.json")

	if enc, err := os.ReadFile(encPath); err == nil {
		if a.sealer == nil {
			return nil, fmt.Errorf("암호화 모듈이 초기화되지 않았습니다")
		}
		b, err := a.sealer.Open(enc)
		if err != nil {
			return nil, fmt.Errorf("토큰 복호화 실패 (재인증 필요): %w", err)
		}
		tok := &oauth2.Token{}
		if err := json.Unmarshal(b, tok); err != nil {
			return nil, err
		}
		return tok, nil
	}

	// 구버전 평문 토큰 → 암호화 파일로 이전
	b, err := os.ReadFile(legacyPath)
	if err != nil {
		return nil, err
	}
	tok := &oauth2.Token{}
	if err := json.Unmarshal(b, tok); err != nil {
		return nil, err
	}
	if err := a.saveToken(tok); err == nil {
		_ = os.Remove(legacyPath)
	}
	return tok, nil
}

func (a *Adapter) saveToken(tok *oauth2.Token) error {
	if a.sealer == nil {
		return fmt.Errorf("암호화 모듈이 초기화되지 않았습니다")
	}
	b, err := json.Marshal(tok)
	if err != nil {
		return err
	}
	enc, err := a.sealer.Seal(b)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(a.configDir, "token.enc"), enc, 0o600)
}

func (a *Adapter) Authorized() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.config != nil && a.token != nil
}

// authResult 는 루프백 리다이렉트로 전달된 결과다.
type authResult struct {
	code   string
	errMsg string // Google이 전달한 오류 (access_denied 등)
}

// Authorize 는 루프백 리다이렉트 방식의 OAuth 2.0 인증을 수행한다.
// 브라우저 응답을 기다리는 동안 뮤텍스를 잡지 않으므로 다른 호출(Authorized 등)이 막히지 않고,
// 이미 인증이 진행 중이면 즉시 오류를 반환한다.
func (a *Adapter) Authorize() error {
	if !a.authBusy.CompareAndSwap(false, true) {
		return fmt.Errorf("인증이 이미 진행 중입니다. 브라우저 창을 확인하거나 잠시 후 다시 시도하세요")
	}
	defer a.authBusy.Store(false)

	a.mu.Lock()
	if a.config == nil {
		cfg, err := a.loadConfig()
		if err != nil {
			a.mu.Unlock()
			return err
		}
		a.config = cfg
	}
	cfg := *a.config
	a.mu.Unlock()

	if a.openURL == nil {
		return fmt.Errorf("브라우저 열기 함수가 설정되지 않았습니다")
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	resCh := make(chan authResult, 1)
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		res := authResult{code: r.URL.Query().Get("code"), errMsg: r.URL.Query().Get("error")}
		if res.errMsg != "" {
			fmt.Fprint(w, "인증이 거부되었습니다. 이 창을 닫고 앱에서 다시 시도해주세요.")
		} else {
			fmt.Fprint(w, "HOLMZ 인증이 완료되었습니다. 이 창을 닫아주세요.")
		}
		select {
		case resCh <- res:
		default:
		}
	})}
	go srv.Serve(ln)
	defer srv.Close()

	cfg.RedirectURL = "http://" + ln.Addr().String()
	if err := a.openURL(cfg.AuthCodeURL("state", oauth2.AccessTypeOffline)); err != nil {
		return err
	}

	select {
	case res := <-resCh:
		if res.errMsg != "" {
			return fmt.Errorf("Google이 인증을 거부했습니다 (%s). OAuth 동의 화면의 사용자 유형·테스트 사용자 설정을 확인하세요", res.errMsg)
		}
		if res.code == "" {
			return fmt.Errorf("인증 코드가 전달되지 않았습니다")
		}
		tok, err := cfg.Exchange(context.Background(), res.code)
		if err != nil {
			return fmt.Errorf("토큰 교환 실패: %w", err)
		}
		a.mu.Lock()
		a.token = tok
		a.mu.Unlock()
		return a.saveToken(tok)
	case <-time.After(authTimeout):
		return fmt.Errorf("인증 대기 시간이 초과되었습니다. 다시 시도해주세요")
	}
}

func (a *Adapter) services(ctx context.Context) (*drive.Service, *sheets.Service, error) {
	a.mu.Lock()
	config, token := a.config, a.token
	a.mu.Unlock()
	if config == nil || token == nil {
		return nil, nil, fmt.Errorf("인증되지 않았습니다")
	}
	client := config.Client(ctx, token)
	d, err := drive.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, nil, err
	}
	s, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, nil, err
	}
	return d, s, nil
}

func (a *Adapter) findOrCreateFolder(d *drive.Service) (string, error) {
	q := fmt.Sprintf("name='%s' and mimeType='application/vnd.google-apps.folder' and trashed=false", folderName)
	list, err := d.Files.List().Q(q).Fields("files(id)").Do()
	if err != nil {
		return "", err
	}
	if len(list.Files) > 0 {
		return list.Files[0].Id, nil
	}
	f, err := d.Files.Create(&drive.File{Name: folderName, MimeType: "application/vnd.google-apps.folder"}).Fields("id").Do()
	if err != nil {
		return "", err
	}
	return f.Id, nil
}

func (a *Adapter) findOrCreateSpreadsheet(d *drive.Service, folderID, name string) (id, url string, err error) {
	q := fmt.Sprintf("name='%s' and '%s' in parents and trashed=false", name, folderID)
	list, err := d.Files.List().Q(q).Fields("files(id, webViewLink)").Do()
	if err != nil {
		return "", "", err
	}
	if len(list.Files) > 0 {
		return list.Files[0].Id, list.Files[0].WebViewLink, nil
	}
	f, err := d.Files.Create(&drive.File{
		Name:     name,
		MimeType: "application/vnd.google-apps.spreadsheet",
		Parents:  []string{folderID},
	}).Fields("id, webViewLink").Do()
	if err != nil {
		return "", "", err
	}
	return f.Id, f.WebViewLink, nil
}

// UploadDay 는 "HOLMZ 근로기록" 폴더의 일자별 스프레드시트에 근로기록·체크리스트를 기록한다.
func (a *Adapter) UploadDay(date string, logs []domain.WorkLog, entries []domain.ChecklistEntry) (string, error) {
	ctx := context.Background()
	d, s, err := a.services(ctx)
	if err != nil {
		return "", err
	}
	folderID, err := a.findOrCreateFolder(d)
	if err != nil {
		return "", fmt.Errorf("Drive 폴더 준비 실패: %w", err)
	}
	ssID, url, err := a.findOrCreateSpreadsheet(d, folderID, "HOLMZ_"+date)
	if err != nil {
		return "", fmt.Errorf("스프레드시트 준비 실패: %w", err)
	}

	if _, err := s.Spreadsheets.Values.Update(ssID, "A1", &sheets.ValueRange{Values: workLogRows(logs)}).
		ValueInputOption("RAW").Do(); err != nil {
		return "", fmt.Errorf("근로기록 기록 실패: %w", err)
	}

	// "체크리스트" 시트가 없으면 추가한다 (이미 있으면 에러 무시).
	_, _ = s.Spreadsheets.BatchUpdate(ssID, &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{{AddSheet: &sheets.AddSheetRequest{
			Properties: &sheets.SheetProperties{Title: "체크리스트"},
		}}},
	}).Do()

	clRows := [][]any{{"구분", "항목", "필수", "완료", "완료시각", "작성자", "첨부사진"}}
	for _, e := range entries {
		typ := "오픈"
		if e.Type == "close" {
			typ = "마감"
		}
		clRows = append(clRows, []any{typ, e.Name, e.Required, e.Checked, e.CheckedAt, e.CheckedBy, e.PhotoPath})
	}
	if _, err := s.Spreadsheets.Values.Update(ssID, "'체크리스트'!A1", &sheets.ValueRange{Values: clRows}).
		ValueInputOption("RAW").Do(); err != nil {
		return "", fmt.Errorf("체크리스트 기록 실패: %w", err)
	}
	return url, nil
}
