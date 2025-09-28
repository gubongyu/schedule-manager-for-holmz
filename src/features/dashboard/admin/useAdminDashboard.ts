import { useEffect, useMemo, useState } from 'react';
import { api, type Attendance } from '@/lib/api';

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useAdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const todayKey = getLocalDateKey(new Date());

  const [totalWorkers, setTotalWorkers] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [pendingSubs, setPendingSubs] = useState<number>(0);
  const [todayAssignedCount, setTodayAssignedCount] = useState<number>(0);
  const [todayUnassignedCount, setTodayUnassignedCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [workers, attendance, pending, shifts] = await Promise.all([
          api.users.listWorkers(),
          api.attendance.getAttendanceByDate(todayKey),
          api.substitutions.countSubstitutionsByStatus('pending'),
          api.shifts.getShiftsByMonth(todayKey.slice(0, 7)),
        ]);

        setTotalWorkers(workers.length);
        setTodayAttendance(attendance ?? []);
        setPendingSubs(pending);

        const todaysShifts = shifts.filter(s => s.date === todayKey);
        setTodayAssignedCount(todaysShifts.filter(s => !!s.workerId).length);
        setTodayUnassignedCount(todaysShifts.filter(s => !s.workerId).length);

      } catch (e: any) {
        setErr(e?.message ?? '대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [todayKey]);

  const stats = useMemo(() => {
    const working = todayAttendance.filter(a => a.status === 'working').length;
    const ended = todayAttendance.filter(a => a.status === 'ended').length;
    return { working, ended };
  }, [todayAttendance]);

  return {
    loading,
    err,
    todayKey,
    totalWorkers,
    todayAttendance,
    pendingSubs,
    todayAssignedCount,
    todayUnassignedCount,
    stats,
  };
};