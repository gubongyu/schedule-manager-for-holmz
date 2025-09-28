import { useEffect, useState, useCallback } from 'react';
import { api, type WorkLog } from '@/lib/api';

export const useAdminWorkLogReport = () => {
  const [workLogs, setWorkLogs] = useState<(WorkLog & { profiles: { username: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchWorkLogs = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.workLogs.listAllWorkLogs();
      setWorkLogs(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '업무 기록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkLogs();
  }, [fetchWorkLogs]);

  return {
    workLogs,
    loading,
    err,
  };
};
