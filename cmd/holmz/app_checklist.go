package main

// 체크리스트(점검 항목·사진 첨부) 바인딩.

import (
	"fmt"

	"holmz/internal/domain"
	"holmz/internal/service"
)

func (a *App) TodayChecklist(typ string) (*service.ChecklistView, error) {
	return a.checklist.Today(typ)
}

func (a *App) CheckItem(entryID int64, checked bool, by string) error {
	return a.checklist.Check(entryID, checked, by)
}

func (a *App) CompleteChecklist(typ, by string) error { return a.checklist.Complete(typ, by) }

func (a *App) ChecklistTemplates(typ string) ([]domain.ChecklistTemplate, error) {
	return a.checklist.Templates(typ)
}

func (a *App) AddChecklistTemplate(typ, name string, sortOrder int, required bool) (*domain.ChecklistTemplate, error) {
	return a.checklist.AddTemplate(typ, name, sortOrder, required)
}

func (a *App) UpdateChecklistTemplate(t domain.ChecklistTemplate) error {
	return a.checklist.UpdateTemplate(&t)
}

func (a *App) RemoveChecklistTemplate(id int64) error { return a.checklist.RemoveTemplate(id) }

// --- 사진 첨부 ---

// AttachChecklistPhoto 는 파일 대화상자로 이미지를 골라 사진 저장소에 넣고 항목에 연결한다.
// 취소하면 빈 문자열을 반환한다.
func (a *App) AttachChecklistPhoto(entryID int64) (string, error) {
	src, err := a.pickFile("사진 선택", "이미지 (*.png;*.jpg;*.jpeg;*.webp)", "*.png;*.jpg;*.jpeg;*.webp")
	if err != nil || src == "" {
		return "", err
	}
	dest, err := a.photos.Save(fmt.Sprintf("entry_%d", entryID), src)
	if err != nil {
		return "", err
	}
	if err := a.checklist.AttachPhoto(entryID, dest); err != nil {
		return "", err
	}
	return dest, nil
}

// RemoveChecklistPhoto 는 첨부를 해제하고 저장된 사진을 삭제한다.
func (a *App) RemoveChecklistPhoto(entryID int64, path string) error {
	if err := a.checklist.AttachPhoto(entryID, ""); err != nil {
		return err
	}
	if path == "" {
		return nil
	}
	return a.photos.Remove(path)
}

// PhotoDataURL 은 저장된 사진을 data URL로 반환한다 (WebView 표시용).
func (a *App) PhotoDataURL(path string) (string, error) { return a.photos.DataURL(path) }
