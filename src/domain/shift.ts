export interface Shift {
  id: number | string;
  date: string; // 'YYYY-MM-DD'
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  worker_uid?: string | null;
  isWeekend?: boolean;
}

export interface RecurringShift {
  id: string;
  day_of_week: number;
  start: string;
  end: string;
  worker_uid?: string | null;
}