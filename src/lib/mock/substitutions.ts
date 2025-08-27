import { SubstitutionRequest } from '@/types';
import { mockUsers } from './users';

export let mockSubstitutions: SubstitutionRequest[] = [
  {
    id: 'sub1',
    date: '2024-12-28',
    timeRange: '07:00 - 15:00',
    ownerId: 'worker1',
    ownerName: '김민수',
    applicantIds: ['worker2', 'worker3'],
    applicants: [
      mockUsers.find(u => u.id === 'worker2')!,
      mockUsers.find(u => u.id === 'worker3')!
    ],
    status: 'pending',
    createdAt: '2024-12-25T10:00:00Z'
  },
  {
    id: 'sub2',
    date: '2024-12-29',
    timeRange: '15:00 - 22:00',
    ownerId: 'worker2',
    ownerName: '이서영',
    applicantIds: ['worker4'],
    applicants: [mockUsers.find(u => u.id === 'worker4')!],
    status: 'approved',
    createdAt: '2024-12-24T14:30:00Z'
  },
  {
    id: 'sub3',
    date: '2024-12-30',
    timeRange: '07:00 - 22:00',
    ownerId: 'worker3',
    ownerName: '박정호',
    applicantIds: [],
    applicants: [],
    status: 'rejected',
    createdAt: '2024-12-23T09:15:00Z'
  }
];

export const getSubstitutionsByUser = (userId: string): SubstitutionRequest[] => {
  return mockSubstitutions.filter(sub => 
    sub.ownerId === userId || sub.applicantIds.includes(userId)
  );
};

export const addSubstitution = (request: Omit<SubstitutionRequest, 'id' | 'createdAt'>): SubstitutionRequest => {
  const newRequest: SubstitutionRequest = {
    ...request,
    id: `sub${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  mockSubstitutions.push(newRequest);
  return newRequest;
};

export const updateSubstitutionStatus = (id: string, status: 'approved' | 'rejected'): SubstitutionRequest | null => {
  const index = mockSubstitutions.findIndex(sub => sub.id === id);
  if (index === -1) return null;
  
  mockSubstitutions[index] = { ...mockSubstitutions[index], status };
  return mockSubstitutions[index];
};

export const applyToSubstitution = (substitutionId: string, workerId: string): SubstitutionRequest | null => {
  const index = mockSubstitutions.findIndex(sub => sub.id === substitutionId);
  if (index === -1) return null;
  
  const worker = mockUsers.find(u => u.id === workerId);
  if (!worker) return null;
  
  if (!mockSubstitutions[index].applicantIds.includes(workerId)) {
    mockSubstitutions[index].applicantIds.push(workerId);
    mockSubstitutions[index].applicants.push(worker);
  }
  
  return mockSubstitutions[index];
};