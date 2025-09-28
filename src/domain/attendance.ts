export interface Attendance {
  id?: number;
  userId: string;
  userName?: string;
  date: string;    // 'YYYY-MM-DD'
  startAt?: string; // 'HH:MM'
  endAt?: string;   // 'HH:MM'
  status: 'working' | 'ended' | 'not_started';
}
