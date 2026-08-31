package sqlite

import "holmz/internal/domain"

type EmployeeRepo struct{ db *DB }

func NewEmployeeRepo(db *DB) *EmployeeRepo { return &EmployeeRepo{db: db} }

func (r *EmployeeRepo) Create(e *domain.Employee) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO employees (name, student_id, department, start_date, active) VALUES (?,?,?,?,?)",
		e.Name, e.StudentID, e.Department, e.StartDate, e.Active)
	if err != nil {
		return err
	}
	e.ID, err = res.LastInsertId()
	return err
}

func (r *EmployeeRepo) Update(e *domain.Employee) error {
	_, err := r.db.SQL.Exec(
		"UPDATE employees SET name=?, student_id=?, department=?, start_date=?, active=? WHERE id=?",
		e.Name, e.StudentID, e.Department, e.StartDate, e.Active, e.ID)
	return err
}

func (r *EmployeeRepo) Get(id int64) (*domain.Employee, error) {
	e := &domain.Employee{}
	err := r.db.SQL.QueryRow(
		"SELECT id, name, student_id, department, start_date, active FROM employees WHERE id=?", id).
		Scan(&e.ID, &e.Name, &e.StudentID, &e.Department, &e.StartDate, &e.Active)
	if err != nil {
		return nil, err
	}
	e.EndDate = e.WorkEndDate()
	return e, nil
}

func (r *EmployeeRepo) List(activeOnly bool) ([]domain.Employee, error) {
	q := "SELECT id, name, student_id, department, start_date, active FROM employees"
	if activeOnly {
		q += " WHERE active=1"
	}
	q += " ORDER BY name"
	rows, err := r.db.SQL.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Employee
	for rows.Next() {
		var e domain.Employee
		if err := rows.Scan(&e.ID, &e.Name, &e.StudentID, &e.Department, &e.StartDate, &e.Active); err != nil {
			return nil, err
		}
		e.EndDate = e.WorkEndDate()
		out = append(out, e)
	}
	return out, rows.Err()
}
