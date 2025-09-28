import { Profile } from '@/domain';

export const mockUsers: Profile[] = [
  {
    auth_id: 'admin',
    username: '관리자',
    role: 'admin'
  },
  {
    auth_id: 'worker1',
    username: '김민수',
    role: 'worker',
    department: '영업팀'
  },
  {
    auth_id: 'worker2',
    username: '이서영',
    role: 'worker',
    department: '학생'
  },
  {
    auth_id: 'worker3',
    username: '박정호',
    role: 'worker',
    department: '개발팀'
  },
  {
    auth_id: 'worker4',
    username: '최은지',
    role: 'worker',
    department: '디자인팀'
  },
  {
    auth_id: 'worker5',
    username: '정재훈',
    role: 'worker',
    department: '인사팀'
  },
  {
    auth_id: 'worker6',
    username: '한유진',
    role: 'worker',
    department: '재무팀'
  }
];

export const findProfileById = (id: string): Profile | undefined => {
  return mockUsers.find(user => user.auth_id === id);
};