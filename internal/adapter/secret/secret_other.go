//go:build !windows

package secret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"os"
	"path/filepath"
)

// 비Windows(개발 환경) 폴백: 설정 디렉터리의 키 파일(0600)로 AES-256-GCM 암호화.

type aesSealer struct{ gcm cipher.AEAD }

func New(configDir string) (Sealer, error) {
	keyPath := filepath.Join(configDir, "token.key")
	key, err := os.ReadFile(keyPath)
	if err != nil || len(key) != 32 {
		key = make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return nil, err
		}
		if err := os.WriteFile(keyPath, key, 0o600); err != nil {
			return nil, err
		}
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return aesSealer{gcm: gcm}, nil
}

func (s aesSealer) Seal(data []byte) ([]byte, error) {
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return s.gcm.Seal(nonce, nonce, data, nil), nil
}

func (s aesSealer) Open(data []byte) ([]byte, error) {
	if len(data) < s.gcm.NonceSize() {
		return nil, errors.New("잘못된 암호문")
	}
	nonce, ct := data[:s.gcm.NonceSize()], data[s.gcm.NonceSize():]
	return s.gcm.Open(nil, nonce, ct, nil)
}
