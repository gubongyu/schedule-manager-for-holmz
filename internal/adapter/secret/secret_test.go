package secret

import (
	"bytes"
	"testing"
)

func TestSealOpenRoundTrip(t *testing.T) {
	dir := t.TempDir()
	s, err := New(dir)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	plain := []byte(`{"access_token":"secret-token"}`)
	sealed, err := s.Seal(plain)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if bytes.Contains(sealed, []byte("secret-token")) {
		t.Error("sealed data contains plaintext")
	}
	opened, err := s.Open(sealed)
	if err != nil || !bytes.Equal(opened, plain) {
		t.Fatalf("Open = %q, err=%v; want original", opened, err)
	}
}

func TestOpenAcrossInstances(t *testing.T) {
	dir := t.TempDir()
	s1, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := s1.Seal([]byte("persist me"))
	if err != nil {
		t.Fatal(err)
	}
	// 같은 설정 디렉터리로 새 인스턴스를 만들어도 복호화되어야 한다 (키 영속성).
	s2, err := New(dir)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := s2.Open(sealed)
	if err != nil || string(opened) != "persist me" {
		t.Fatalf("Open across instances = %q, err=%v", opened, err)
	}
}

func TestOpenRejectsTamperedData(t *testing.T) {
	s, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := s.Seal([]byte("data"))
	if err != nil {
		t.Fatal(err)
	}
	sealed[len(sealed)-1] ^= 0xFF
	if _, err := s.Open(sealed); err == nil {
		t.Error("tampered data should fail to open")
	}
}
