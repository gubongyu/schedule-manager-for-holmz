package sqlite

import (
	"database/sql"

	"holmz/internal/domain"
)

type ChecklistRepo struct{ db *DB }

func NewChecklistRepo(db *DB) *ChecklistRepo { return &ChecklistRepo{db: db} }

func (r *ChecklistRepo) CreateTemplate(t *domain.ChecklistTemplate) error {
	res, err := r.db.SQL.Exec(
		"INSERT INTO checklist_templates (type, name, sort_order, required, active) VALUES (?,?,?,?,?)",
		t.Type, t.Name, t.SortOrder, t.Required, t.Active)
	if err != nil {
		return err
	}
	t.ID, err = res.LastInsertId()
	return err
}

func (r *ChecklistRepo) UpdateTemplate(t *domain.ChecklistTemplate) error {
	_, err := r.db.SQL.Exec(
		"UPDATE checklist_templates SET type=?, name=?, sort_order=?, required=?, active=? WHERE id=?",
		t.Type, t.Name, t.SortOrder, t.Required, t.Active, t.ID)
	return err
}

func (r *ChecklistRepo) DeleteTemplate(id int64) error {
	_, err := r.db.SQL.Exec("DELETE FROM checklist_templates WHERE id=?", id)
	return err
}

func (r *ChecklistRepo) ListTemplates(typ string) ([]domain.ChecklistTemplate, error) {
	rows, err := r.db.SQL.Query(
		"SELECT id, type, name, sort_order, required, active FROM checklist_templates WHERE type=? ORDER BY sort_order, id", typ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ChecklistTemplate
	for rows.Next() {
		var t domain.ChecklistTemplate
		if err := rows.Scan(&t.ID, &t.Type, &t.Name, &t.SortOrder, &t.Required, &t.Active); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *ChecklistRepo) EnsureEntries(date, typ string) error {
	_, err := r.db.SQL.Exec(`
		INSERT OR IGNORE INTO checklist_entries (date, template_id, type, name, required)
		SELECT ?, id, type, name, required FROM checklist_templates WHERE type=? AND active=1`, date, typ)
	return err
}

func (r *ChecklistRepo) ListEntries(date, typ string) ([]domain.ChecklistEntry, error) {
	rows, err := r.db.SQL.Query(`
		SELECT ce.id, ce.date, ce.template_id, ce.type, ce.name, ce.required,
		       ce.checked, ce.checked_at, ce.checked_by, ce.photo_path
		FROM checklist_entries ce
		JOIN checklist_templates ct ON ct.id = ce.template_id
		WHERE ce.date=? AND ce.type=? ORDER BY ct.sort_order, ce.id`, date, typ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.ChecklistEntry
	for rows.Next() {
		var e domain.ChecklistEntry
		if err := rows.Scan(&e.ID, &e.Date, &e.TemplateID, &e.Type, &e.Name, &e.Required,
			&e.Checked, &e.CheckedAt, &e.CheckedBy, &e.PhotoPath); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *ChecklistRepo) SetChecked(entryID int64, checked bool, checkedAt, checkedBy string) error {
	if !checked {
		checkedAt, checkedBy = "", ""
	}
	_, err := r.db.SQL.Exec("UPDATE checklist_entries SET checked=?, checked_at=?, checked_by=? WHERE id=?",
		checked, checkedAt, checkedBy, entryID)
	return err
}

func (r *ChecklistRepo) SetPhoto(entryID int64, path string) error {
	_, err := r.db.SQL.Exec("UPDATE checklist_entries SET photo_path=? WHERE id=?", path, entryID)
	return err
}

func (r *ChecklistRepo) SaveCompletion(c *domain.ChecklistCompletion) error {
	_, err := r.db.SQL.Exec(
		"INSERT OR REPLACE INTO checklist_completions (date, type, completed_at, completed_by) VALUES (?,?,?,?)",
		c.Date, c.Type, c.CompletedAt, c.CompletedBy)
	return err
}

func (r *ChecklistRepo) GetCompletion(date, typ string) (*domain.ChecklistCompletion, error) {
	c := &domain.ChecklistCompletion{}
	err := r.db.SQL.QueryRow(
		"SELECT date, type, completed_at, completed_by FROM checklist_completions WHERE date=? AND type=?", date, typ).
		Scan(&c.Date, &c.Type, &c.CompletedAt, &c.CompletedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}
