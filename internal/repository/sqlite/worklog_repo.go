package sqlite

import (
	"database/sql"
	"strings"

	"holmz/internal/domain"
)

type WorkLogRepo struct{ db *DB }

func NewWorkLogRepo(db *DB) *WorkLogRepo { return &WorkLogRepo{db: db} }

const workLogSelect = `SELECT w.id, w.employee_id, e.name, e.student_id, w.date, w.clock_in, w.clock_out, w.task_notes, w.sync_status
FROM work_logs w JOIN employees e ON e.id = w.employee_id `

func scanWorkLog(row interface{ Scan(...any) error }) (*domain.WorkLog, error) {
	w := &domain.WorkLog{}
	err := row.Scan(&w.ID, &w.EmployeeID, &w.EmployeeName, &w.StudentID, &w.Date, &w.ClockIn, &w.ClockOut, &w.TaskNotes, &w.SyncStatus)
	if err != nil {
		return nil, err
	}
	w.TotalHrs = w.TotalHours()
	return w, nil
}

func (r *WorkLogRepo) Create(w *domain.WorkLog) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO work_logs (employee_id, date, clock_in, clock_out, task_notes, sync_status) VALUES (?,?,?,?,?,?)",
		w.EmployeeID, w.Date, w.ClockIn, w.ClockOut, w.TaskNotes, w.SyncStatus)
	if err != nil {
		return err
	}
	w.ID, err = res.LastInsertId()
	return err
}

func (r *WorkLogRepo) Update(w *domain.WorkLog) error {
	_, err := r.db.SQL.Exec(
		"UPDATE work_logs SET clock_out=?, task_notes=?, sync_status=? WHERE id=?",
		w.ClockOut, w.TaskNotes, w.SyncStatus, w.ID)
	return err
}

func (r *WorkLogRepo) GetOpen(employeeID int64) (*domain.WorkLog, error) {
	row := r.db.SQL.QueryRow(workLogSelect+"WHERE w.employee_id=? AND w.clock_out='' ORDER BY w.id DESC LIMIT 1", employeeID)
	w, err := scanWorkLog(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return w, err
}

func (r *WorkLogRepo) ListPending() ([]domain.WorkLog, error) {
	rows, err := r.db.SQL.Query(workLogSelect + "WHERE w.sync_status='pending' AND w.clock_out != '' ORDER BY w.date, w.id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.WorkLog
	for rows.Next() {
		w, err := scanWorkLog(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *w)
	}
	return out, rows.Err()
}

func (r *WorkLogRepo) MarkSynced(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	q := "UPDATE work_logs SET sync_status='synced' WHERE id IN (?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	_, err := r.db.SQL.Exec(q, args...)
	return err
}

func (r *WorkLogRepo) List(from, to string, employeeID int64) ([]domain.WorkLog, error) {
	q := workLogSelect + "WHERE w.date >= ? AND w.date <= ?"
	args := []any{from, to}
	if employeeID != 0 {
		q += " AND w.employee_id = ?"
		args = append(args, employeeID)
	}
	q += " ORDER BY w.date DESC, e.name"
	rows, err := r.db.SQL.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.WorkLog
	for rows.Next() {
		w, err := scanWorkLog(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *w)
	}
	return out, rows.Err()
}
