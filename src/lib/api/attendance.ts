import { supabase } from '@/lib/supabaseClient';
import type { AttendanceLog } from '@/domain';

const fmt = (t?: string | null) => (t ? t.slice(0,5) : undefined);
const todayKey = () => new Date().toISOString().slice(0,10);

export const getAttendanceByDate = async (date: string) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, user_uid, date, start_at, end_at, status')
    .eq('date', date)
    .order('user_uid', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    user_uid: r.user_uid,
    date: r.date,
    start_at: fmt(r.start_at),
    end_at: fmt(r.end_at),
    status: r.status,
  })) as AttendanceLog[];
};

export const getAttendanceByUserDate = async (userId: string, date = todayKey()) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, user_uid, date, start_at, end_at, status')
    .eq('user_uid', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    user_uid: data.user_uid,
    date: data.date,
    start_at: fmt(data.start_at),
    end_at: fmt(data.end_at),
    status: data.status,
  } as AttendanceLog;
};

export const startWork = async (userId: string) => {
  const date = todayKey();
  // upsert by (user_uid, date)
  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert(
      { user_uid: userId, date, start_at: new Date().toTimeString().slice(0,5), status: 'working' },
      { onConflict: 'user_uid,date' }
    )
    .select('id, user_uid, date, start_at, end_at, status')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('startWork 실패');
  return {
    id: data.id,
    user_uid: data.user_uid,
    date: data.date,
    start_at: fmt(data.start_at),
    end_at: fmt(data.end_at),
    status: data.status,
  } as AttendanceLog;
};

export const endWork = async (userId: string) => {
  const date = todayKey();
  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ end_at: new Date().toTimeString().slice(0,5), status: 'ended' })
    .eq('user_uid', userId)
    .eq('date', date)
    .select('id, user_uid, date, start_at, end_at, status')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('endWork 실패(먼저 start 필요)');
  return {
    id: data.id,
    user_uid: data.user_uid,
    date: data.date,
    start_at: fmt(data.start_at),
    end_at: fmt(data.end_at),
    status: data.status,
  } as AttendanceLog;
};