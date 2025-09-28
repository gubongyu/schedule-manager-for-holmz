import { supabase } from '@/lib/supabaseClient';
import type { Substitution, SubstitutionApplicant } from '@/domain';

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
export const listSubstitutions = async (): Promise<Substitution[]> => {
  const { data: subs, error } = await supabase
    .from('substitutions')
    .select('id, date, start, end, owner_uid, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  if (!subs || subs.length === 0) return [];

  return subs.map(s => ({
    id: s.id,
    date: s.date,
    start: fmt(s.start),
    end: fmt(s.end),
    owner_uid: s.owner_uid,
    status: s.status,
    created_at: s.created_at,
  }));
};

// 상태 변경
export const updateSubstitutionStatus = async (
  id: number,
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
  date: string; start: string; end: string; owner_uid: string;
}): Promise<Substitution> => {
  const { data, error } = await supabase
    .from('substitutions')
    .insert({
      date: payload.date,
      start: payload.start,
      end: payload.end,
      owner_uid: payload.owner_uid,
      status: 'pending',
    })
    .select('id, date, start, end, owner_uid, status, created_at')
    .single();
  if (error) throw error;

  return {
    id: data.id,
    date: data.date,
    start: fmt(data.start),
    end: fmt(data.end),
    owner_uid: data.owner_uid,
    status: data.status,
    created_at: data.created_at,
  };
};

// ✅ 요청에 지원(중복 지원 방지: UNIQUE(substitution_id, user_id) 전제)
export const applyToSubstitution = async (
  substitutionId: number,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('substitution_applicants')
    .insert({ substitution_id: substitutionId, user_uid: userId }, { count: 'exact' });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
};