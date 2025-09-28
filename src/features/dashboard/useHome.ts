import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { api, type AttendanceLog, type Shift } from '@/lib/api';

type BusyKey = 'start' | 'end' | null;

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useHome = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState<BusyKey>(null);
  const today = useMemo(() => getLocalDateKey(new Date()), []);

  // Worker-specific state
  const [att, setAtt] = useState<AttendanceLog | null>(null);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [wLoading, setWLoading] = useState<boolean>(true);
  const [wErr, setWErr] = useState<string | null>(null);

  // Admin-specific state
  const [aLoading, setALoading] = useState<boolean>(true);
  const [aErr, setAErr] = useState<string | null>(null);
  const [todayWorkingCount, setTodayWorkingCount] = useState<number>(0);
  const [pendingSubs, setPendingSubs] = useState<number>(0);
  const [weekShiftDays, setWeekShiftDays] = useState<number>(0);

  // Worker data fetching
  useEffect(() => {
    if (user?.role !== 'worker') return;
    (async () => {
      if (!user?.auth_id) return;
      setWLoading(true);
      setWErr(null);
      try {
        const [attendance, shifts] = await Promise.all([
          api.attendance.getAttendanceByUserDate(user.auth_id, today),
          api.shifts.getShiftsByWorker(user.auth_id),
        ]);
        setAtt(attendance ?? null);
        setMyShifts(shifts ?? []);
      } catch (e: any) {
        setWErr(e?.message ?? '데이터를 불러오지 못했습니다.');
      } finally {
        setWLoading(false);
      }
    })();
  }, [user?.auth_id, user?.role, today]);

  // Admin data fetching
  useEffect(() => {
    if (user?.role !== 'admin') return;
    (async () => {
      setALoading(true);
      setAErr(null);
      try {
        const todays = await api.attendance.getAttendanceByDate(today);
        setTodayWorkingCount((todays ?? []).filter(r => r.status === 'working').length);

        try {
          const pending = await api.substitutions.countSubstitutionsByStatus('pending');
          setPendingSubs(pending);
        } catch {
          const rows = await api.substitutions.listSubstitutions();
          setPendingSubs(rows.filter(r => r.status === 'pending').length);
        }

        const start = new Date();
        const dow = start.getDay();
        start.setDate(start.getDate() - dow);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const startKey = getLocalDateKey(start);
        const endKey = getLocalDateKey(end);
        const monthKeys = Array.from(new Set([startKey.slice(0, 7), endKey.slice(0, 7)]));
        const monthShiftsArrays = await Promise.all(monthKeys.map(k => api.shifts.getShiftsByMonth(k)));
        const all = monthShiftsArrays.flat() as Shift[];
        const inWeek = all.filter(s => s.date >= startKey && s.date <= endKey);
        const daySet = new Set(inWeek.map(s => s.date));
        setWeekShiftDays(daySet.size);
      } catch (e: any) {
        setAErr(e?.message ?? '통계를 불러오지 못했습니다.');
      } finally {
        setALoading(false);
      }
    })();
  }, [user?.role, today]);

  const handleStartWork = async () => {
    if (!user?.auth_id) return;
    if (att?.status === 'working' || att?.status === 'ended') {
      toast({ variant: 'destructive', title: '이미 처리된 상태입니다' });
      return;
    }
    setBusy('start');
    try {
      const updated = await api.attendance.startWork(user.auth_id);
      setAtt(updated);
      toast({ title: '근무 시작', description: '근무를 시작했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '시작 실패', description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleEndWork = async () => {
    if (!user?.auth_id) return;
    if (att?.status !== 'working') {
      toast({ variant: 'destructive', title: '근무를 시작해주세요' });
      return;
    }
    setBusy('end');
    try {
      const updated = await api.attendance.endWork(user.auth_id);
      setAtt(updated);
      toast({ title: '근무 종료', description: '근무를 종료했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '종료 실패', description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  return {
    user,
    busy,
    // Worker data
    workerState: {
      att,
      myShifts,
      loading: wLoading,
      err: wErr,
    },
    // Admin data
    adminState: {
      loading: aLoading,
      err: aErr,
      todayWorkingCount,
      pendingSubs,
      weekShiftDays,
    },
    handleStartWork,
    handleEndWork,
  };
};