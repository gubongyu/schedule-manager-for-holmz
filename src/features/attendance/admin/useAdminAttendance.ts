import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { AttendanceLog, Profile } from '@/domain';

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useAdminAttendance = () => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey(new Date()));
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ws = await api.users.listWorkers();
        const normalized = ws.map((w: any) => ({
          auth_id: w.auth_id,
          username: w.username ?? '이름없음',
          department: w.department,
          role: w.role ?? 'worker',
        })) as Profile[];
        setProfiles(normalized);
      } catch (e: any) {
        console.error("Failed to fetch profiles", e);
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

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.auth_id, p));
    return m;
  }, [profiles]);

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
    profileMap,
    loading,
    err,
    stats,
  };
};
