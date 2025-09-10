import { supabase } from '@/lib/supabaseClient';

export type Attendance = {
  id?: number;
  userId: string;
  userName?: string;
  date: string;    // 'YYYY-MM-DD'
  startAt?: string; // 'HH:MM'
  endAt?: string;   // 'HH:MM'
  status: 'working' | 'ended' | 'not_started';
};

const fmt = (t?: string | null) => (t ? t.slice(0,5) : undefined);
const todayKey = () => new Date().toISOString().slice(0,10);

export const getAttendanceByDate = async (date: string) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, user_id, user_name, date, start_at, end_at, status')
    .eq('date', date)
    .order('user_id', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    date: r.date,
    startAt: fmt(r.start_at),
    endAt: fmt(r.end_at),
    status: r.status,
  })) as Attendance[];
};

export const getAttendanceByUserDate = async (userId: string, date = todayKey()) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, user_id, user_name, date, start_at, end_at, status')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    date: data.date,
    startAt: fmt(data.start_at),
    endAt: fmt(data.end_at),
    status: data.status,
  } as Attendance;
};

export const startWork = async (userId: string) => {
  const date = todayKey();
  // upsert by (user_id, date)
  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert(
      { user_id: userId, date, start_at: new Date().toTimeString().slice(0,5), status: 'working' },
      { onConflict: 'user_id,date' }
    )
    .select('id, user_id, user_name, date, start_at, end_at, status')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('startWork 실패');
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    date: data.date,
    startAt: fmt(data.start_at),
    endAt: fmt(data.end_at),
    status: data.status,
  } as Attendance;
};

export const endWork = async (userId: string) => {
  const date = todayKey();
  const { data, error } = await supabase
    .from('attendance_logs')
    .update({ end_at: new Date().toTimeString().slice(0,5), status: 'ended' })
    .eq('user_id', userId)
    .eq('date', date)
    .select('id, user_id, user_name, date, start_at, end_at, status')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('endWork 실패(먼저 start 필요)');
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    date: data.date,
    startAt: fmt(data.start_at),
    endAt: fmt(data.end_at),
    status: data.status,
  } as Attendance;
};
