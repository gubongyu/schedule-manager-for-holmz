export interface WorkLog {
  id: number;
  profile_id: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  content: string;
  floor_2_people: number;
  floor_4_people: number;
  extra_notes?: string;
}
