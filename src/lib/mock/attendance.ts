import { AttendanceLog, Shift } from '@/domain';
import { mockShifts } from './shifts';
import { mockUsers } from './users';

export let mockAttendance: AttendanceLog[] = [
  {
    id: 1,
    user_uid: 'worker1',
    date: '2024-12-27',
    start_at: '07:15',
    end_at: '22:05',
    status: 'ended'
  },
  {
    id: 2,
    user_uid: 'worker2',
    date: '2024-12-27',
    start_at: '07:30',
    status: 'working'
  },
  {
    id: 3,
    user_uid: 'worker3',
    date: '2024-12-27',
    status: 'not_started'
  }
];

export const getTodayAttendance = (): AttendanceLog[] => {
  const today = new Date().toISOString().split('T')[0];
  return mockAttendance.filter(att => att.date === today);
};

export const getAttendanceByDate = (date: string): AttendanceLog[] => {
  return mockAttendance.filter(att => att.date === date);
};

export const getAttendanceByUser = (userId: string, date: string): AttendanceLog | undefined => {
  return mockAttendance.find(att => att.user_uid === userId && att.date === date);
};

export const startWork = (userId: string): AttendanceLog => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  const user = mockUsers.find(u => u.auth_id === userId);
  
  const existingIndex = mockAttendance.findIndex(att => 
    att.user_uid === userId && att.date === today
  );
  
  if (existingIndex >= 0) {
    mockAttendance[existingIndex] = {
      ...mockAttendance[existingIndex],
      start_at: now,
      status: 'working'
    };
    return mockAttendance[existingIndex];
  } else {
    const newAttendance: AttendanceLog = {
      id: Date.now(),
      user_uid: userId,
      date: today,
      start_at: now,
      status: 'working'
    };
    mockAttendance.push(newAttendance);
    return newAttendance;
  }
};

export const endWork = (userId: string): AttendanceLog | null => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  
  const index = mockAttendance.findIndex(att => 
    att.user_uid === userId && att.date === today
  );
  
  if (index === -1) return null;
  
  mockAttendance[index] = {
    ...mockAttendance[index],
    end_at: now,
    status: 'ended'
  };
  
  return mockAttendance[index];
};

export const getShiftsByWorker = (workerId: string): Shift[] => {
  return mockShifts.filter(shift => shift.worker_uid === workerId);
};