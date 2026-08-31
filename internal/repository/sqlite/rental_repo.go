package sqlite

import "holmz/internal/domain"

type RentalRepo struct{ db *DB }

func NewRentalRepo(db *DB) *RentalRepo { return &RentalRepo{db: db} }

const rentalCols = `id, date, time, staff, student_id, name, phone, place, device_no,
	return_date, return_time, return_staff`

func (r *RentalRepo) Create(v *domain.Rental) error {
	res, err := r.db.SQL.Exec(`INSERT INTO rentals
		(date, time, staff, student_id, name, phone, place, device_no, return_date, return_time, return_staff)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
		v.Date, v.Time, v.Staff, v.StudentID, v.Name, v.Phone, v.Place, v.DeviceNo,
		v.ReturnDate, v.ReturnTime, v.ReturnStaff)
	if err != nil {
		return err
	}
	v.ID, err = res.LastInsertId()
	return err
}

func (r *RentalRepo) Update(v *domain.Rental) error {
	_, err := r.db.SQL.Exec(`UPDATE rentals SET
		date=?, time=?, staff=?, student_id=?, name=?, phone=?, place=?, device_no=?,
		return_date=?, return_time=?, return_staff=? WHERE id=?`,
		v.Date, v.Time, v.Staff, v.StudentID, v.Name, v.Phone, v.Place, v.DeviceNo,
		v.ReturnDate, v.ReturnTime, v.ReturnStaff, v.ID)
	return err
}

func (r *RentalRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM rentals WHERE id=?", id)
	return err
}

// List 는 최근 대여부터 반환한다 (미반납 건을 먼저 보기 쉽도록 날짜·시간 역순).
func (r *RentalRepo) List() ([]domain.Rental, error) {
	rows, err := r.db.SQL.Query(
		"SELECT " + rentalCols + " FROM rentals ORDER BY date DESC, time DESC, id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Rental
	for rows.Next() {
		var v domain.Rental
		if err := rows.Scan(&v.ID, &v.Date, &v.Time, &v.Staff, &v.StudentID, &v.Name, &v.Phone,
			&v.Place, &v.DeviceNo, &v.ReturnDate, &v.ReturnTime, &v.ReturnStaff); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
