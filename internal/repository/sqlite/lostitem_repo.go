package sqlite

import "holmz/internal/domain"

type LostItemRepo struct{ db *DB }

func NewLostItemRepo(db *DB) *LostItemRepo { return &LostItemRepo{db: db} }

const lostCols = `id, type, date, item, feature, student_id, name, phone, claim_date, claim_staff`

func (r *LostItemRepo) Create(v *domain.LostItem) error {
	res, err := r.db.SQL.Exec(`INSERT INTO lost_items
		(type, date, item, feature, student_id, name, phone, claim_date, claim_staff)
		VALUES (?,?,?,?,?,?,?,?,?)`,
		v.Type, v.Date, v.Item, v.Feature, v.StudentID, v.Name, v.Phone, v.ClaimDate, v.ClaimStaff)
	if err != nil {
		return err
	}
	v.ID, err = res.LastInsertId()
	return err
}

func (r *LostItemRepo) Update(v *domain.LostItem) error {
	_, err := r.db.SQL.Exec(`UPDATE lost_items SET
		type=?, date=?, item=?, feature=?, student_id=?, name=?, phone=?, claim_date=?, claim_staff=?
		WHERE id=?`,
		v.Type, v.Date, v.Item, v.Feature, v.StudentID, v.Name, v.Phone, v.ClaimDate, v.ClaimStaff, v.ID)
	return err
}

func (r *LostItemRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM lost_items WHERE id=?", id)
	return err
}

// List 는 최근 기록부터 반환한다. typ 이 빈 문자열이면 습득·접수를 모두 포함한다.
func (r *LostItemRepo) List(typ string) ([]domain.LostItem, error) {
	q := "SELECT " + lostCols + " FROM lost_items"
	var args []any
	if typ != "" {
		q += " WHERE type=?"
		args = append(args, typ)
	}
	q += " ORDER BY date DESC, id DESC"
	rows, err := r.db.SQL.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.LostItem
	for rows.Next() {
		var v domain.LostItem
		if err := rows.Scan(&v.ID, &v.Type, &v.Date, &v.Item, &v.Feature,
			&v.StudentID, &v.Name, &v.Phone, &v.ClaimDate, &v.ClaimStaff); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
