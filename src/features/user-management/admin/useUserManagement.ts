
import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { Worker } from '@/domain';

export const useUserManagement = () => {
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // State for the add worker form
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('');

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ws = await api.users.listWorkers();
      const normalized: Worker[] = (ws ?? []).map((w: any) => ({
        id: w.id,
        name: w.name ?? w.username ?? '이름없음',
        department: w.department ?? '',
        role: (w.role ?? 'worker') as 'worker' | 'admin',
      }));
      setRows(normalized);
    } catch (e: any) {
      setErr(e?.message ?? '근무자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const workers = useMemo(() => rows.filter(u => u.role === 'worker'), [rows]);

  const addWorker = async (payload: { name: string; department: string }) => {
    if (!payload.name.trim() || !payload.department.trim()) {
      toast({ variant: 'destructive', title: '입력 필요', description: '이름과 소속을 입력하세요.' });
      return;
    }

    setIsAdding(true);
    try {
      const created = await api.users.createWorker(payload);
      const normalized: Worker = {
        id: created.id,
        name: created.name ?? created.username ?? payload.name.trim(),
        department: created.department ?? payload.department.trim(),
        role: (created.role ?? 'worker') as 'worker' | 'admin',
      };
      setRows(prev => [normalized, ...prev]);
      toast({ title: '근무자 추가 완료', description: '근무자가 추가되었습니다.' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '추가 실패',
        description: e?.message ?? '근무자 추가 중 오류가 발생했습니다.',
      });
      throw e; // re-throw for the component to handle
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addWorker({ name: newWorkerName, department: newWorkerDept });
      setNewWorkerName('');
      setNewWorkerDept('');
    } catch (e) {
      // Error is already handled by the toast in the hook
      console.error(e);
    }
  };

  const deleteWorker = async (workerId: string, workerName: string) => {
    setDeletingId(workerId);
    try {
      setRows(prev => prev.filter(u => u.id !== workerId));
      await api.users.deleteWorker(workerId);
      toast({ title: '근무자 삭제 완료', description: `${workerName}님이 삭제되었습니다.` });
    } catch (e: any) {
      await fetchWorkers(); // rollback by refetching
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: e?.message ?? '근무자 삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return {
    workers,
    loading,
    err,
    deletingId,
    isAdding,
    deleteWorker,
    // For Add Worker Form
    newWorkerName,
    setNewWorkerName,
    newWorkerDept,
    setNewWorkerDept,
    handleAddWorker,
  };
};
