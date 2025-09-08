import { User } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'admin',
    name: '관리자',
    role: 'admin'
  },
  {
    id: 'worker1',
    name: '김민수',
    role: 'worker',
    department: '영업팀'
  },
  {
    id: 'worker2',
    name: '이서영',
    role: 'worker',
    department: '학생'
  },
  {
    id: 'worker3',
    name: '박정호',
    role: 'worker',
    department: '개발팀'
  },
  {
    id: 'worker4',
    name: '최은지',
    role: 'worker',
    department: '디자인팀'
  },
  {
    id: 'worker5',
    name: '정재훈',
    role: 'worker',
    department: '인사팀'
  },
  {
    id: 'worker6',
    name: '한유진',
    role: 'worker',
    department: '재무팀'
  }
];

export const findUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id);
};