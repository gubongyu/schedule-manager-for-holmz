package googledrive

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/oauth2"
)

const testCredentials = `{"installed":{"client_id":"x.apps.googleusercontent.com","client_secret":"secret","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","redirect_uris":["http://localhost"]}}`

func TestNotAuthorizedWithoutFiles(t *testing.T) {
	a := New(t.TempDir(), nil)
	if a.Authorized() {
		t.Error("Authorized() = true with no credentials, want false")
	}
	err := a.Authorize()
	if err == nil || !strings.Contains(err.Error(), "credentials.json") {
		t.Errorf("Authorize() err = %v, want mention of credentials.json", err)
	}
}

func TestLegacyPlaintextTokenMigratedToEncrypted(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "credentials.json"), []byte(testCredentials), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "token.json"),
		[]byte(`{"access_token":"tok","refresh_token":"ref","token_type":"Bearer"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	a := New(dir, nil)
	if !a.Authorized() {
		t.Error("Authorized() = false with legacy plaintext token, want true")
	}
	// 평문 token.json 은 암호화 파일(token.enc)로 이전되고 삭제되어야 한다
	if _, err := os.Stat(filepath.Join(dir, "token.json")); !os.IsNotExist(err) {
		t.Error("legacy token.json should be removed after migration")
	}
	enc, err := os.ReadFile(filepath.Join(dir, "token.enc"))
	if err != nil {
		t.Fatalf("token.enc missing: %v", err)
	}
	if strings.Contains(string(enc), "ref") && strings.Contains(string(enc), "refresh_token") {
		t.Error("token.enc appears to contain plaintext token")
	}
}

func TestEncryptedTokenRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "credentials.json"), []byte(testCredentials), 0o600); err != nil {
		t.Fatal(err)
	}
	a := New(dir, nil)
	if a.Authorized() {
		t.Fatal("Authorized before token save, want false")
	}
	if err := a.saveToken(&oauth2.Token{AccessToken: "tok", RefreshToken: "ref", TokenType: "Bearer"}); err != nil {
		t.Fatalf("saveToken: %v", err)
	}
	// 새 인스턴스가 암호화 토큰을 읽을 수 있어야 한다
	b := New(dir, nil)
	if !b.Authorized() {
		t.Error("Authorized() = false after encrypted save, want true")
	}
}
