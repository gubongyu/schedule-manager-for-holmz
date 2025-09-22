import { useEffect, useMemo, useState, useCallback } from 'react';
import { api, type Attendance } from '@/lib/api';

export type Worker = {
  id: string;
  name: string;
  department?: string;
};

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useAdminAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey(new Date()));
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ws = await api.users.listWorkers();
        const normalized = ws.map((w: any) => ({
          id: w.id,
          name: w.name ?? w.username ?? '이름없음',
          department: w.department,
        })) as Worker[];
        setWorkers(normalized);
      } catch (e: any) {
        console.error("Failed to fetch workers", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await api.attendance.getAttendanceByDate(selectedDate);
        setAttendance(data ?? []);
      } catch (e: any) {
        setErr(e?.message ?? '출퇴근 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDate]);

  const workerMap = useMemo(() => {
    const m = new Map<string, Worker>();
    workers.forEach(w => m.set(w.id, w));
    return m;
  }, [workers]);

  const stats = useMemo(() => ({
    total: attendance.length,
    working: attendance.filter(att => att.status === 'working').length,
    ended: attendance.filter(att => att.status === 'ended').length,
    notStarted: attendance.filter(att => att.status === 'not_started').length,
  }), [attendance]);

  return {
    selectedDate,
    setSelectedDate,
    attendance,
    workerMap,
    loading,
    err,
    stats,
  };
};
