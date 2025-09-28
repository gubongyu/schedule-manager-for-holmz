export interface SubstitutionRequest {
  id: string | number;
  date: string;          // 'YYYY-MM-DD'
  timeRange: string;     // 'HH:MM - HH:MM'
  ownerId: string;
  ownerName: string;
  applicants: Array<{ id: string; name: string }>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;     // ISO
}
