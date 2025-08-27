import { Attendance } from '@/types';
import { mockUsers } from './users';

export let mockAttendance: Attendance[] = [
  {
    id: 'att1',
    userId: 'worker1',
    userName: '김민수',
    date: '2024-12-27',
    startAt: '07:15',
    endAt: '22:05',
    status: 'ended'
  },
  {
    id: 'att2',
    userId: 'worker2',
    userName: '이서영',
    date: '2024-12-27',
    startAt: '07:30',
    status: 'working'
  },
  {
    id: 'att3',
    userId: 'worker3',
    userName: '박정호',
    date: '2024-12-27',
    status: 'not_started'
  }
];

export const getTodayAttendance = (): Attendance[] => {
  const today = new Date().toISOString().split('T')[0];
  return mockAttendance.filter(att => att.date === today);
};

export const getAttendanceByDate = (date: string): Attendance[] => {
  return mockAttendance.filter(att => att.date === date);
};

export const getAttendanceByUser = (userId: string, date: string): Attendance | undefined => {
  return mockAttendance.find(att => att.userId === userId && att.date === date);
};

export const startWork = (userId: string): Attendance => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  const user = mockUsers.find(u => u.id === userId);
  
  const existingIndex = mockAttendance.findIndex(att => 
    att.userId === userId && att.date === today
  );
  
  if (existingIndex >= 0) {
    mockAttendance[existingIndex] = {
      ...mockAttendance[existingIndex],
      startAt: now,
      status: 'working'
    };
    return mockAttendance[existingIndex];
  } else {
    const newAttendance: Attendance = {
      id: `att${Date.now()}`,
      userId,
      userName: user?.name || '',
      date: today,
      startAt: now,
      status: 'working'
    };
    mockAttendance.push(newAttendance);
    return newAttendance;
  }
};

export const endWork = (userId: string): Attendance | null => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().slice(0, 5);
  
  const index = mockAttendance.findIndex(att => 
    att.userId === userId && att.date === today
  );
  
  if (index === -1) return null;
  
  mockAttendance[index] = {
    ...mockAttendance[index],
    endAt: now,
    status: 'ended'
  };
  
  return mockAttendance[index];
};