import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api, type AttendanceLog } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type BusyKey = 'start' | 'end' | null;

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useWorkerDashboard = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState<BusyKey>(null);
  const [attendance, setAttendance] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => getLocalDateKey(new Date()), []);

  const fetchAttendance = useCallback(async () => {
    if (!user?.auth_id) return;
    setLoading(true);
    setErr(null);
    try {
      const row = await api.attendance.getAttendanceByUserDate(user.auth_id, today);
      setAttendance(row ?? null);
    } catch (e: any) {
      setErr(e?.message ?? '출퇴근 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.auth_id, today]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const startWork = async () => {
    if (!user?.auth_id) return;
    if (attendance?.status === 'working' || attendance?.status === 'ended') {
      toast({
        variant: 'destructive',
        title: '이미 처리된 상태입니다',
        description: attendance.status === 'working' ? '이미 근무를 시작했습니다.' : '이미 근무를 종료했습니다.',
      });
      return;
    }

    setBusy('start');
    try {
      const updated = await api.attendance.startWork(user.auth_id);
      setAttendance(updated);
      toast({ title: '근무 시작', description: '근무를 시작했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '시작 실패', description: e?.message ?? '오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  const endWork = async () => {
    if (!user?.auth_id) return;
    if (attendance?.status === 'ended') {
      toast({ variant: 'destructive', title: '이미 처리된 상태입니다', description: '이미 근무를 종료했습니다.' });
      return;
    }
    if (attendance?.status !== 'working') {
      toast({
        variant: 'destructive',
        title: '근무를 시작해주세요',
        description: '근무 시작 후 종료할 수 있습니다.',
      });
      return;
    }

    setBusy('end');
    try {
      const updated = await api.attendance.endWork(user.auth_id);
      setAttendance(updated);
      toast({ title: '근무 종료', description: '근무를 종료했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '종료 실패', description: e?.message ?? '오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  return {
    user,
    attendance,
    loading,
    err,
    busy,
    startWork,
    endWork,
  };
};
