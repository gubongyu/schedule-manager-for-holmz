package sqlite

import "holmz/internal/domain"

type ShiftRepo struct{ db *DB }

func NewShiftRepo(db *DB) *ShiftRepo { return &ShiftRepo{db: db} }

func (r *ShiftRepo) Create(s *domain.Shift) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO shifts (employee_id, weekday, start_time, end_time) VALUES (?,?,?,?)",
		s.EmployeeID, s.Weekday, s.Start, s.End)
	if err != nil {
		return err
	}
	s.ID, err = res.LastInsertId()
	return err
}

func (r *ShiftRepo) Update(s *domain.Shift) error {
	_, err := r.db.SQL.Exec(
		"UPDATE shifts SET employee_id=?, weekday=?, start_time=?, end_time=? WHERE id=?",
		s.EmployeeID, s.Weekday, s.Start, s.End, s.ID)
	return err
}

func (r *ShiftRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM shifts WHERE id=?", id)
	return err
}

func (r *ShiftRepo) List() ([]domain.Shift, error) {
	rows, err := r.db.SQL.Query(`
		SELECT s.id, s.employee_id, e.name, s.weekday, s.start_time, s.end_time
		FROM shifts s JOIN employees e ON e.id = s.employee_id
		ORDER BY s.start_time, e.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Shift
	for rows.Next() {
		var s domain.Shift
		if err := rows.Scan(&s.ID, &s.EmployeeID, &s.EmployeeName, &s.Weekday, &s.Start, &s.End); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
