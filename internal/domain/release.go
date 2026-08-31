package domain

// Release 는 배포처에 올라온 최신 버전 정보다.
type Release struct {
	Version     string // 버전 태그 (예: v1.2.3)
	Notes       string // 릴리스 설명 (사용자에게 보여줄 변경 내용)
	DownloadURL string // 실행 파일 자산 주소. 자산이 없으면 빈 문자열
	PageURL     string // 릴리스 페이지 주소 (사용자가 브라우저로 열어볼 곳)
	SHA256      string // 실행 파일의 SHA-256 (배포처가 제공하지 않으면 빈 문자열 — 검증 생략)
	Size        int64  // 실행 파일 크기 (바이트)
}
