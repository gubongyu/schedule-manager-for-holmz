export interface AttendanceLog {
  id?: number;
  user_uid: string;
  date: string; // 'YYYY-MM-DD'
  start_at?: string; // 'HH:MM'
  end_at?: string; // 'HH:MM'
  status: 'working' | 'ended' | 'not_started';
}