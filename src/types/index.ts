export interface User {
  id: string;
  name: string;
  role: 'worker' | 'admin';
  department?: string;
}

export interface Shift {
  id: string;
  date: string;
  start: string;
  end: string;
  workerId: string;
  isWeekend: boolean;
}

export interface SubstitutionRequest {
  id: string;
  date: string;
  timeRange: string;
  ownerId: string;
  ownerName: string;
  applicantIds: string[];
  applicants: User[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startAt?: string;
  endAt?: string;
  status: 'working' | 'ended' | 'not_started';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface DashboardStats {
  todayWorking: number;
  pendingRequests: number;
  weeklyScheduled: number;
}