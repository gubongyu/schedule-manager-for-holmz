package sqlite

import "holmz/internal/domain"

type ShiftOverrideRepo struct{ db *DB }

func NewShiftOverrideRepo(db *DB) *ShiftOverrideRepo { return &ShiftOverrideRepo{db: db} }

func (r *ShiftOverrideRepo) Create(o *domain.ShiftOverride) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO shift_overrides (date, employee_id, type, start_time, end_time, note) VALUES (?,?,?,?,?,?)",
		o.Date, o.EmployeeID, o.Type, o.Start, o.End, o.Note)
	if err != nil {
		return err
	}
	o.ID, err = res.LastInsertId()
	return err
}

func (r *ShiftOverrideRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM shift_overrides WHERE id=?", id)
	return err
}

func (r *ShiftOverrideRepo) ListRange(from, to string) ([]domain.ShiftOverride, error) {
	rows, err := r.db.SQL.Query(`
		SELECT o.id, o.date, o.employee_id, e.name, o.type, o.start_time, o.end_time, o.note
		FROM shift_overrides o JOIN employees e ON e.id = o.employee_id
		WHERE o.date >= ? AND o.date <= ?
		ORDER BY o.date, o.start_time, e.name`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ShiftOverride
	for rows.Next() {
		var o domain.ShiftOverride
		if err := rows.Scan(&o.ID, &o.Date, &o.EmployeeID, &o.EmployeeName, &o.Type, &o.Start, &o.End, &o.Note); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
