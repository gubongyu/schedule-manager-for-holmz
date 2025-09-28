export interface Substitution {
  id: string | number;
  date: string; // 'YYYY-MM-DD'
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  owner_uid: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string; // ISO
}

export interface SubstitutionApplicant {
  substitution_id: number;
  user_uid: string;
  applied_at: string;
}