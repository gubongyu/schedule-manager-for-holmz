
import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Profile } from '@/domain';

export const useUserManagement = () => {
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newDept, setNewDept] = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ws = await api.users.listWorkers();
      const normalized: Profile[] = (ws ?? []).map((w: any) => ({
        auth_id: w.auth_id,
        username: w.username ?? '이름없음',
        department: w.department ?? '',
        role: (w.role ?? 'worker') as 'worker' | 'admin',
      }));
      setRows(normalized);
    } catch (e: any) {
      setErr(e?.message ?? '프로필 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const profiles = useMemo(() => rows.filter(u => u.role === 'worker'), [rows]);

  const addProfile = async (payload: { username: string; department: string }) => {
    if (!payload.username.trim() || !payload.department.trim()) {
      toast({ variant: 'destructive', title: '입력 필요', description: '이름과 소속을 입력하세요.' });
      return;
    }

    setIsAdding(true);
    try {
      const created = await api.users.createWorker({ name: payload.username, department: payload.department });
      const normalized: Profile = {
        auth_id: created.auth_id,
        username: created.username ?? payload.username.trim(),
        department: created.department ?? payload.department.trim(),
        role: (created.role ?? 'worker') as 'worker' | 'admin',
      };
      setRows(prev => [normalized, ...prev]);
      toast({ title: '프로필 추가 완료', description: '프로필이 추가되었습니다.' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '추가 실패',
        description: e?.message ?? '프로필 추가 중 오류가 발생했습니다.',
      });
      throw e; // re-throw for the component to handle
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addProfile({ username: newUsername, department: newDept });
      setNewUsername('');
      setNewDept('');
    } catch (e) {
      // Error is already handled by the toast in the hook
      console.error(e);
    }
  };

  const deleteProfile = async (profileId: string, profileName: string) => {
    setDeletingId(profileId);
    try {
      setRows(prev => prev.filter(u => u.auth_id !== profileId));
      await api.users.deleteWorker(profileId);
      toast({ title: '프로필 삭제 완료', description: `${profileName}님이 삭제되었습니다.` });
    } catch (e: any) {
      await fetchProfiles(); // rollback by refetching
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: e?.message ?? '프로필 삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return {
    profiles,
    loading,
    err,
    deletingId,
    isAdding,
    deleteProfile,
    // For Add Profile Form
    newUsername,
    setNewUsername,
    newDept,
    setNewDept,
    handleAddProfile,
  };
};
