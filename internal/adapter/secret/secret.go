// Package secret 은 민감 데이터(OAuth 토큰 등)의 로컬 암호화를 제공한다.
// Windows에서는 DPAPI(사용자 단위, 키 파일 불필요), 그 외 플랫폼(개발 환경)에서는
// 설정 디렉터리의 키 파일 기반 AES-256-GCM을 사용한다.
package secret

// Sealer 는 바이트 열을 암호화(Seal)/복호화(Open)한다.
type Sealer interface {
	Seal(data []byte) ([]byte, error)
	Open(data []byte) ([]byte, error)
}
