// Package githubrelease 는 GitHub Releases에서 최신 버전 정보를 읽는다.
// domain.ReleaseSource 구현체이며, 공개 저장소를 전제로 인증 없이 조회한다.
package githubrelease

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"holmz/internal/domain"
)

// assetName 은 릴리스에 올라오는 실행 파일 자산 이름이다.
// 같은 이름에 .sha256 을 붙인 자산이 함께 있으면 무결성 검증에 쓴다 (없어도 무방).
const (
	assetName    = "holmz.exe"
	checksumName = assetName + ".sha256"
)

// downloadTimeout 은 실행 파일(수십 MB) 내려받기 한도다. 조회보다 넉넉히 준다.
const downloadTimeout = 10 * time.Minute

// apiBase 는 GitHub REST API 주소다 (테스트에서 교체).
const apiBase = "https://api.github.com"

type Source struct {
	owner, repo string
	baseURL     string
	client      *http.Client
}

// New 는 공개 저장소의 릴리스를 조회하는 소스를 만든다.
func New(owner, repo string) *Source {
	return &Source{owner: owner, repo: repo, baseURL: apiBase,
		client: &http.Client{Timeout: 10 * time.Second}}
}

// latestResponse 는 GitHub 릴리스 응답 중 필요한 부분이다.
type latestResponse struct {
	TagName string `json:"tag_name"`
	Body    string `json:"body"`
	HTMLURL string `json:"html_url"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
		Size int64  `json:"size"`
	} `json:"assets"`
}

// Latest 는 최신 릴리스를 반환한다. 릴리스가 없거나 저장소가 비공개면 (nil, nil)이다
// — 알릴 것이 없을 뿐 오류로 다루지 않는다 (매장 PC에 경고를 띄우지 않기 위해).
func (s *Source) Latest() (*domain.Release, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases/latest", s.baseURL, s.owner, s.repo)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("릴리스 조회 실패 (HTTP %d)", resp.StatusCode)
	}

	var body latestResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("릴리스 응답을 읽을 수 없습니다: %w", err)
	}

	rel := &domain.Release{Version: body.TagName, Notes: body.Body, PageURL: body.HTMLURL}
	for _, a := range body.Assets {
		switch a.Name {
		case assetName:
			rel.DownloadURL, rel.Size = a.URL, a.Size
		case checksumName:
			// 못 읽어도 릴리스 자체는 유효하다 — 검증만 건너뛴다.
			rel.SHA256 = s.fetchChecksum(a.URL)
		}
	}
	return rel, nil
}

// fetchChecksum 은 "<hex>  holmz.exe" 형태의 자산에서 해시만 떼어낸다.
// 실패하면 빈 문자열을 돌려준다 (검증 생략).
func (s *Source) fetchChecksum(url string) string {
	resp, err := s.client.Get(url)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, 256))
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

// Download 는 실행 파일을 dst 에 내려받는다. 실패하면 부분 파일을 남기지 않는다.
func (s *Source) Download(url, dst string) error {
	client := &http.Client{Timeout: downloadTimeout}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("내려받기 실패 (HTTP %d)", resp.StatusCode)
	}

	f, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(dst)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(dst)
		return err
	}
	return nil
}
