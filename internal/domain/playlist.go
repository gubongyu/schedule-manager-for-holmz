package domain

// PlaylistItem 은 매장에서 반복 재생할 YouTube 영상이다 (기획서 6.4).
type PlaylistItem struct {
	ID        int64  `json:"id"`
	SortOrder int    `json:"sortOrder"`
	Title     string `json:"title"`
	VideoURL  string `json:"videoUrl"`
	VideoID   string `json:"videoId"`
	Active    bool   `json:"active"`
}
