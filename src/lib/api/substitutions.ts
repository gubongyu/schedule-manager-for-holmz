import { supabase } from '@/lib/supabaseClient';
import type { SubstitutionRequest } from '@/domain';

// time 문자열 다듬기
const fmt = (t?: string | null) => t ? t.slice(0, 5) : '00:00';

// 상태 카운트 (대시보드 등에서 사용)
export const countSubstitutionsByStatus = async (
  status: 'pending' | 'approved' | 'rejected'
): Promise<number> => {
  const { count, error } = await supabase
    .from('substitutions')
    .select('id', { count: 'exact', head: true })
    .eq('status', status);
  if (error) throw error;
  return count ?? 0;
};

// 목록 조회
export const listSubstitutions = async (): Promise<SubstitutionRequest[]> => {
  // 1) 본문(소유자/시간대) 조회
  const { data: subs, error } = await supabase
    .from('substitutions')
    .select('id, date, start, end, owner_id, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!subs || subs.length === 0) return [];

  // 소유자 id 수집
  const ownerIds = Array.from(new Set(subs.map(s => s.owner_id).filter(Boolean)));

  // 2) 소유자 이름 조회
  const { data: owners, error: ownerErr } = await supabase
    .from('profiles')
    .select('id, username, name')
    .in('id', ownerIds);
  if (ownerErr) throw ownerErr;

  const ownerNameMap = new Map<string, string>();
  (owners ?? []).forEach(o => ownerNameMap.set(o.id, o.name ?? o.username ?? o.id));

  // 3) 지원자 관계 조회
  const subIds = subs.map(s => s.id);
  const { data: links, error: linkErr } = await supabase
    .from('substitution_applicants')
    .select('substitution_id, user_id')
    .in('substitution_id', subIds as any);
  if (linkErr) throw linkErr;

  const applicantIds = Array.from(new Set((links ?? []).map(l => l.user_id)));
  let applicantNameMap = new Map<string, string>();
  if (applicantIds.length > 0) {
    const { data: applicants, error: appErr } = await supabase
      .from('profiles')
      .select('id, username, name')
      .in('id', applicantIds);
    if (appErr) throw appErr;
    applicantNameMap = new Map<string, string>();
    (applicants ?? []).forEach(a => applicantNameMap.set(a.id, a.name ?? a.username ?? a.id));
  }

  // 4) timeRange 포맷터
  const fmt = (t: string) => t?.slice(0, 5) ?? '00:00';

  // 5) 합치기
  const bySubId = new Map<string | number, Array<{ id: string; name: string }>>();
  (links ?? []).forEach(l => {
    const arr = bySubId.get(l.substitution_id) ?? [];
    arr.push({ id: l.user_id, name: applicantNameMap.get(l.user_id) ?? l.user_id });
    bySubId.set(l.substitution_id, arr);
  });

  return subs.map(s => ({
    id: s.id,
    date: s.date,
    timeRange: `${fmt(s.start)} - ${fmt(s.end)}`,
    ownerId: s.owner_id,
    ownerName: ownerNameMap.get(s.owner_id) ?? s.owner_id,
    applicants: bySubId.get(s.id) ?? [],
    status: s.status,
    createdAt: s.created_at,
  }));
};

// 상태 변경
export const updateSubstitutionStatus = async (
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> => {
  const { error } = await supabase
    .from('substitutions')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
};

// ✅ 새 요청 생성
export const createSubstitution = async (payload: {
  date: string; start: string; end: string; ownerId: string;
}): Promise<SubstitutionRequest> => {
  const { data, error } = await supabase
    .from('substitutions')
    .insert({
      date: payload.date,
      start: payload.start,
      end: payload.end,
      owner_id: payload.ownerId,
      status: 'pending',
    })
    .select('id, date, start, end, owner_id, status, created_at')
    .single();
  if (error) throw error;

  // ownerName 조회
  const { data: owner, error: oerr } = await supabase
    .from('profiles')
    .select('id, username, name')
    .eq('id', payload.ownerId)
    .maybeSingle();
  if (oerr) throw oerr;

  return {
    id: data.id,
    date: data.date,
    timeRange: `${fmt(data.start)} - ${fmt(data.end)}`,
    ownerId: data.owner_id,
    ownerName: owner ? (owner.name ?? owner.username ?? owner.id) : payload.ownerId,
    applicants: [],
    status: data.status,
    createdAt: data.created_at,
  };
};

// ✅ 요청에 지원(중복 지원 방지: UNIQUE(substitution_id, user_id) 전제)
export const applyToSubstitution = async (
  substitutionId: string,
  userId: string
): Promise<{ id: string; name: string }> => {
  // 먼저 지원자 이름 확보
  const { data: prof, error: perr } = await supabase
    .from('profiles')
    .select('id, username, name')
    .eq('id', userId)
    .single();
  if (perr) throw perr;
  const display = prof.name ?? prof.username ?? prof.id;

  // upsert/ignore
  const { error } = await supabase
    .from('substitution_applicants')
    .insert({ substitution_id: substitutionId, user_id: userId }, { count: 'exact' });
  // 중복일 때 에러를 던지는 드라이버도 있어서, 필요하면 여기서 에러코드로 무시 처리 가능
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;

  return { id: userId, name: display };
};