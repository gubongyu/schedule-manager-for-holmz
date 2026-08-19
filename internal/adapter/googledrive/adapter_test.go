package googledrive

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
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

func TestAuthorizedWithStoredToken(t *testing.T) {
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
		t.Error("Authorized() = false with stored credentials+token, want true")
	}
}
