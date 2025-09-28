import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api, type WorkLog } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const useWorkerWorkLog = () => {
  const { user } = useAuth();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchWorkLogs = useCallback(async () => {
    if (!user?.auth_id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await api.workLogs.listWorkLogsByProfile(user.auth_id);
      setWorkLogs(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '업무 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.auth_id]);

  useEffect(() => {
    fetchWorkLogs();
  }, [fetchWorkLogs]);

  const createWorkLog = async (payload: Omit<WorkLog, 'id' | 'profile_id'>) => {
    if (!user?.auth_id) throw new Error('User not found');
    setCreating(true);
    try {
      const newLog = await api.workLogs.createWorkLog({ ...payload, profile_id: user.auth_id });
      setWorkLogs(prev => [newLog, ...prev]);
      toast({ title: '기록 입력 완료', description: '업무 기록이 추가되었습니다.' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '기록 입력 실패',
        description: e?.message ?? '기록 입력 중 오류가 발생했습니다.',
      });
      throw e;
    } finally {
      setCreating(false);
    }
  };

  return {
    workLogs,
    loading,
    err,
    creating,
    createWorkLog,
  };
};
