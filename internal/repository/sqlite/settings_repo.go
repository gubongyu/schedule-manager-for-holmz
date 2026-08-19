package sqlite

import "database/sql"

type SettingsRepo struct{ db *DB }

func NewSettingsRepo(db *DB) *SettingsRepo { return &SettingsRepo{db: db} }

func (r *SettingsRepo) Get(key string) (string, error) {
	var v string
	err := r.db.SQL.QueryRow("SELECT value FROM app_settings WHERE key=?", key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (r *SettingsRepo) Set(key, value string) error {
	_, err := r.db.SQL.Exec("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)", key, value)
	return err
}
