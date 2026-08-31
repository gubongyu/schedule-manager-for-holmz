package service

import (
	"strings"

	"holmz/internal/domain"
)

// 설정 저장 키.
const (
	keyTaskOptions = "task_options"
	keyNotice      = "notice_text"
	keyTTSCommand  = "tts_command"
	keySyncWorklog = "sync_worklog"
	keySyncMaster  = "sync_master"

	keyFeatDashboard    = "feature_dashboard"
	keyFeatRental       = "feature_rental"
	keyFeatLostFound    = "feature_lost_found"
	keyFeatLostReported = "feature_lost_reported"
	keyFeatSubRequest   = "feature_sub_request"
)

// DefaultTaskOptions 는 정각 업무 기록에서 고를 기본 업무 항목이다.
var DefaultTaskOptions = []string{"청소", "재고 정리", "카운터·이용자 응대", "시설 점검", "기타"}

// SettingsService 는 앱 설정(업무 항목·공지사항·TTS 명령)을 읽고 쓴다.
// 저장은 키-값이지만 목록 파싱·기본값 처리는 이 계층이 책임진다.
type SettingsService struct {
	repo domain.SettingsRepo
}

func NewSettingsService(repo domain.SettingsRepo) *SettingsService {
	return &SettingsService{repo: repo}
}

// TaskOptions 는 업무 항목 목록을 반환한다 (미설정이면 기본값).
func (s *SettingsService) TaskOptions() ([]string, error) {
	v, err := s.repo.Get(keyTaskOptions)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, line := range strings.Split(v, "\n") {
		if t := strings.TrimSpace(line); t != "" {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return DefaultTaskOptions, nil
	}
	return out, nil
}

// SetTaskOptions 는 업무 항목 목록을 저장한다. 비우면 기본값이 쓰인다.
func (s *SettingsService) SetTaskOptions(options []string) error {
	var kept []string
	for _, o := range options {
		if t := strings.TrimSpace(o); t != "" {
			kept = append(kept, t)
		}
	}
	return s.repo.Set(keyTaskOptions, strings.Join(kept, "\n"))
}

// Notice 는 근무 시작 시 팝업으로 표시할 공지사항이다.
func (s *SettingsService) Notice() (string, error) { return s.repo.Get(keyNotice) }

func (s *SettingsService) SetNotice(text string) error { return s.repo.Set(keyNotice, text) }

// TTSCommand 는 안내 방송 음성 생성 명령이다. 미설정이면 defaultCmd 를 돌려준다.
func (s *SettingsService) TTSCommand(defaultCmd string) (string, error) {
	v, err := s.repo.Get(keyTTSCommand)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(v) == "" {
		return defaultCmd, nil
	}
	return strings.TrimSpace(v), nil
}

func (s *SettingsService) SetTTSCommand(cmd string) error {
	return s.repo.Set(keyTTSCommand, strings.TrimSpace(cmd))
}

// --- Drive 동기화 대상 ---

// SyncTargets 는 Google Drive로 올릴 항목별 사용 여부다.
type SyncTargets struct {
	Worklog bool `json:"worklog"` // 근로기록·체크리스트 (날짜별 시트)
	Master  bool `json:"master"`  // 직원 명단·근무 스케줄·대타·예외
	Desk    bool `json:"desk"`    // HDMI 대여·분실물
}

// AllSyncTargets 는 미설정 시 적용되는 기본값이다 (모두 사용).
func AllSyncTargets() SyncTargets { return SyncTargets{Worklog: true, Master: true, Desk: true} }

// flag 는 저장된 on/off 값을 읽는다. 미설정이면 def 를 쓴다.
func (s *SettingsService) flag(key string, def bool) (bool, error) {
	v, err := s.repo.Get(key)
	if err != nil {
		return def, err
	}
	switch strings.TrimSpace(v) {
	case "":
		return def, nil
	case "0":
		return false, nil
	default:
		return true, nil
	}
}

func boolValue(b bool) string {
	if b {
		return "1"
	}
	return "0"
}

// SyncTargets 는 동기화 항목 설정을 반환한다 (미설정 항목은 사용으로 간주).
// 대여·분실물은 별도 설정이 아니라 해당 기능 사용 여부를 따른다 — 꺼둔 기능의
// 데이터가 Drive에 계속 올라가지 않도록 한다.
func (s *SettingsService) SyncTargets() (SyncTargets, error) {
	t := AllSyncTargets()
	for _, f := range []struct {
		key string
		dst *bool
	}{{keySyncWorklog, &t.Worklog}, {keySyncMaster, &t.Master}} {
		v, err := s.flag(f.key, true)
		if err != nil {
			return AllSyncTargets(), err
		}
		*f.dst = v
	}
	feats, err := s.Features()
	if err != nil {
		return AllSyncTargets(), err
	}
	t.Desk = feats.DeskEnabled()
	return t, nil
}

// SetSyncTargets 는 근로기록·기준정보 동기화 사용 여부를 저장한다 (Desk 는 기능 설정을 따르므로 무시).
func (s *SettingsService) SetSyncTargets(t SyncTargets) error {
	for _, f := range []struct {
		key string
		val bool
	}{{keySyncWorklog, t.Worklog}, {keySyncMaster, t.Master}} {
		if err := s.repo.Set(f.key, boolValue(f.val)); err != nil {
			return err
		}
	}
	return nil
}

// --- 기능 사용 여부 ---

// Features 는 화면(메뉴) 단위로 켜고 끌 수 있는 기능들이다. 미설정이면 모두 사용.
type Features struct {
	Dashboard    bool `json:"dashboard"`
	Rental       bool `json:"rental"`       // HDMI 대여
	LostFound    bool `json:"lostFound"`    // 분실물 습득
	LostReported bool `json:"lostReported"` // 분실물 접수
	SubRequest   bool `json:"subRequest"`   // 대타 신청 (근무자용)
}

// AllFeatures 는 기본값(모든 기능 사용)이다.
func AllFeatures() Features {
	return Features{Dashboard: true, Rental: true, LostFound: true, LostReported: true, SubRequest: true}
}

// DeskEnabled 은 데스크 업무(대여·분실물) 중 하나라도 쓰이는지 여부다.
func (f Features) DeskEnabled() bool { return f.Rental || f.LostFound || f.LostReported }

func (s *SettingsService) featureFields(f *Features) []struct {
	key string
	dst *bool
} {
	return []struct {
		key string
		dst *bool
	}{
		{keyFeatDashboard, &f.Dashboard},
		{keyFeatRental, &f.Rental},
		{keyFeatLostFound, &f.LostFound},
		{keyFeatLostReported, &f.LostReported},
		{keyFeatSubRequest, &f.SubRequest},
	}
}

func (s *SettingsService) Features() (Features, error) {
	f := AllFeatures()
	for _, fld := range s.featureFields(&f) {
		v, err := s.flag(fld.key, true)
		if err != nil {
			return AllFeatures(), err
		}
		*fld.dst = v
	}
	return f, nil
}

func (s *SettingsService) SetFeatures(f Features) error {
	set := f
	for _, fld := range s.featureFields(&set) {
		if err := s.repo.Set(fld.key, boolValue(*fld.dst)); err != nil {
			return err
		}
	}
	return nil
}
