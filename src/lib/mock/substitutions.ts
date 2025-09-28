import { Substitution, SubstitutionApplicant } from '@/domain';
import { mockUsers } from './users';

export let mockSubstitutions: Substitution[] = [
  {
    id: 1,
    date: '2024-12-28',
    start: '07:00',
    end: '15:00',
    owner_uid: 'worker1',
    status: 'pending',
    created_at: '2024-12-25T10:00:00Z'
  },
  {
    id: 2,
    date: '2024-12-29',
    start: '15:00',
    end: '22:00',
    owner_uid: 'worker2',
    status: 'approved',
    created_at: '2024-12-24T14:30:00Z'
  },
  {
    id: 3,
    date: '2024-12-30',
    start: '07:00',
    end: '22:00',
    owner_uid: 'worker3',
    status: 'rejected',
    created_at: '2024-12-23T09:15:00Z'
  }
];

export let mockSubstitutionApplicants: SubstitutionApplicant[] = [
    { substitution_id: 1, user_uid: 'worker2', applied_at: new Date().toISOString() },
    { substitution_id: 1, user_uid: 'worker3', applied_at: new Date().toISOString() },
    { substitution_id: 2, user_uid: 'worker4', applied_at: new Date().toISOString() },
];

export const getSubstitutionsByUser = (userId: string): Substitution[] => {
  const applicantSubIds = mockSubstitutionApplicants.filter(a => a.user_uid === userId).map(a => a.substitution_id);
  return mockSubstitutions.filter(sub => 
    sub.owner_uid === userId || applicantSubIds.includes(sub.id as number)
  );
};

export const addSubstitution = (request: Omit<Substitution, 'id' | 'created_at'>): Substitution => {
  const newRequest: Substitution = {
    ...request,
    id: Date.now(),
    created_at: new Date().toISOString()
  };
  mockSubstitutions.push(newRequest);
  return newRequest;
};

export const updateSubstitutionStatus = (id: number, status: 'approved' | 'rejected'): Substitution | null => {
  const index = mockSubstitutions.findIndex(sub => sub.id === id);
  if (index === -1) return null;
  
  mockSubstitutions[index] = { ...mockSubstitutions[index], status };
  return mockSubstitutions[index];
};

export const applyToSubstitution = (substitutionId: number, workerId: string): Substitution | null => {
  const index = mockSubstitutions.findIndex(sub => sub.id === substitutionId);
  if (index === -1) return null;
  
  const worker = mockUsers.find(u => u.auth_id === workerId);
  if (!worker) return null;
  
  if (!mockSubstitutionApplicants.find(a => a.substitution_id === substitutionId && a.user_uid === workerId)) {
    mockSubstitutionApplicants.push({ substitution_id: substitutionId, user_uid: workerId, applied_at: new Date().toISOString() });
  }
  
  return mockSubstitutions[index];
};