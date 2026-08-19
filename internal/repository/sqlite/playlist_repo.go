package sqlite

import "holmz/internal/domain"

type PlaylistRepo struct{ db *DB }

func NewPlaylistRepo(db *DB) *PlaylistRepo { return &PlaylistRepo{db: db} }

func (r *PlaylistRepo) Create(p *domain.PlaylistItem) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO playlist_items (sort_order, title, video_url, video_id, active) VALUES (?,?,?,?,?)",
		p.SortOrder, p.Title, p.VideoURL, p.VideoID, p.Active)
	if err != nil {
		return err
	}
	p.ID, err = res.LastInsertId()
	return err
}

func (r *PlaylistRepo) Update(p *domain.PlaylistItem) error {
	_, err := r.db.SQL.Exec(
		"UPDATE playlist_items SET sort_order=?, title=?, video_url=?, video_id=?, active=? WHERE id=?",
		p.SortOrder, p.Title, p.VideoURL, p.VideoID, p.Active, p.ID)
	return err
}

func (r *PlaylistRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM playlist_items WHERE id=?", id)
	return err
}

func (r *PlaylistRepo) List(activeOnly bool) ([]domain.PlaylistItem, error) {
	q := "SELECT id, sort_order, title, video_url, video_id, active FROM playlist_items"
	if activeOnly {
		q += " WHERE active=1"
	}
	q += " ORDER BY sort_order, id"
	rows, err := r.db.SQL.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PlaylistItem
	for rows.Next() {
		var p domain.PlaylistItem
		if err := rows.Scan(&p.ID, &p.SortOrder, &p.Title, &p.VideoURL, &p.VideoID, &p.Active); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
