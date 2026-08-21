package sqlite

import (
	"strings"

	"holmz/internal/domain"
)

type ScheduleRepo struct{ db *DB }

func NewScheduleRepo(db *DB) *ScheduleRepo { return &ScheduleRepo{db: db} }

func joinDays(days []string) string { return strings.Join(days, ",") }

func splitDays(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, ",")
}

func (r *ScheduleRepo) Create(s *domain.ScheduleItem) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO schedules (task_name, run_time, repeat_days, action_type, payload, repeat_count, active) VALUES (?,?,?,?,?,?,?)",
		s.TaskName, s.RunTime, joinDays(s.RepeatDays), s.ActionType, s.Payload, s.Repeat, s.Active)
	if err != nil {
		return err
	}
	s.ID, err = res.LastInsertId()
	return err
}

func (r *ScheduleRepo) Update(s *domain.ScheduleItem) error {
	_, err := r.db.SQL.Exec(
		"UPDATE schedules SET task_name=?, run_time=?, repeat_days=?, action_type=?, payload=?, repeat_count=?, active=? WHERE id=?",
		s.TaskName, s.RunTime, joinDays(s.RepeatDays), s.ActionType, s.Payload, s.Repeat, s.Active, s.ID)
	return err
}

func (r *ScheduleRepo) Delete(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM schedules WHERE id=?", id)
	return err
}

func (r *ScheduleRepo) List() ([]domain.ScheduleItem, error) {
	rows, err := r.db.SQL.Query(
		"SELECT id, task_name, run_time, repeat_days, action_type, payload, repeat_count, active FROM schedules ORDER BY run_time, id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ScheduleItem
	for rows.Next() {
		var s domain.ScheduleItem
		var days string
		if err := rows.Scan(&s.ID, &s.TaskName, &s.RunTime, &days, &s.ActionType, &s.Payload, &s.Repeat, &s.Active); err != nil {
			return nil, err
		}
		s.RepeatDays = splitDays(days)
		out = append(out, s)
	}
	return out, rows.Err()
}
