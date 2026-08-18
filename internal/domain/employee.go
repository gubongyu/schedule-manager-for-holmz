package domain

type Employee struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	PIN    string `json:"pin"`
	Active bool   `json:"active"`
}
