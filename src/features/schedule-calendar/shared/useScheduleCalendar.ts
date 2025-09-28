import { useMemo, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Shift, Profile } from '@/domain';
import { toast } from '@/hooks/use-toast';

export const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getLocalMonthKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const useScheduleCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [shiftsByMonth, setShiftsByMonth] = useState<Record<string, Shift[]>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

  const currentMonthKey = getLocalMonthKey(currentDate);
  const today = getLocalDateKey(new Date());

  // Load profiles once
  useEffect(() => {
    (async () => {
      try {
        const ws = await api.users.listWorkers();
        setProfiles(ws.map((w: any) => ({
          auth_id: w.auth_id,
          username: w.username ?? '이름없음',
          role: w.role,
          department: w.department
        })));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const monthKeysToLoad = useMemo(() => {
    if (viewType !== 'week') return [currentMonthKey];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const keys = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      keys.add(getLocalMonthKey(d));
    }
    return Array.from(keys);
  }, [currentDate, viewType, currentMonthKey]);

  // Load shifts for visible months
  useEffect(() => {
    const toLoad = monthKeysToLoad.filter(k => !(k in shiftsByMonth) && !loadingMonths.has(k));
    if (toLoad.length === 0) return;

    setLoadingMonths(prev => new Set([...prev, ...toLoad]));

    (async () => {
      try {
        const entries = await Promise.all(
          toLoad.map(async (k) => [k, await api.shifts.getShiftsByMonth(k)] as const)
        );
        setShiftsByMonth(prev => {
          const copy = { ...prev };
          for (const [k, rows] of entries) copy[k] = rows;
          return copy;
        });
      } catch (e) {
        toast({ variant: 'destructive', title: '근무표 로드 실패' });
      } finally {
        setLoadingMonths(prev => {
          const copy = new Set(prev);
          toLoad.forEach(k => copy.delete(k));
          return copy;
        });
      }
    })();
  }, [monthKeysToLoad, shiftsByMonth, loadingMonths]);

  const goToPrevious = () => {
    setCurrentDate(d => {
      const newDate = new Date(d);
      if (viewType === 'month') newDate.setMonth(d.getMonth() - 1);
      else newDate.setDate(d.getDate() - 7);
      return newDate;
    });
  };

  const goToNext = () => {
    setCurrentDate(d => {
      const newDate = new Date(d);
      if (viewType === 'month') newDate.setMonth(d.getMonth() + 1);
      else newDate.setDate(d.getDate() + 7);
      return newDate;
    });
  };

  const handleMonthSelect = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const getShiftsForDate = (date: string): Shift[] => {
    const monthKey = date.slice(0, 7);
    const monthShifts = shiftsByMonth[monthKey] ?? [];
    return monthShifts.filter(s => s.date === date);
  };

  const refreshShiftsForMonth = async (monthKey: string) => {
    try {
      setLoadingMonths(prev => new Set([...prev, monthKey]));
      const fresh = await api.shifts.getShiftsByMonth(monthKey);
      setShiftsByMonth(prev => ({ ...prev, [monthKey]: fresh }));
    } catch (e) {
      toast({ variant: 'destructive', title: '새로고침 실패' });
    } finally {
      setLoadingMonths(prev => {
        const copy = new Set(prev);
        copy.delete(monthKey);
        return copy;
      });
    }
  };

  return {
    currentDate,
    viewType,
    setViewType,
    shiftsByMonth,
    profiles,
    loading: loadingMonths.size > 0,
    today,
    currentMonthKey,
    goToPrevious,
    goToNext,
    handleMonthSelect,
    getShiftsForDate,
    refreshShiftsForMonth,
  };
};