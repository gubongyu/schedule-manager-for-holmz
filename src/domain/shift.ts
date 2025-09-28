export interface Shift {
  id: number | string;
  date: string;      // 'YYYY-MM-DD'
  start: string;     // 'HH:MM'
  end: string;       // 'HH:MM'
  workerId?: string | null;
  workerName?: string;
  isWeekend?: boolean;
}
