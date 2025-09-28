import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Shift } from '@/lib/api/shifts';

export const useWorkerSchedule = () => {
  const { user } = useAuth();
  const [currentDate] = useState(new Date());
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [monthShifts, setMonthShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [myShiftsData, monthShiftsData] = await Promise.all([
          api.shifts.getShiftsByWorker(user.id),
          api.shifts.getShiftsByMonth(currentMonth),
        ]);
        setMyShifts(myShiftsData);
        setMonthShifts(monthShiftsData);
      } catch (error) {
        console.error("Failed to fetch shifts", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, currentMonth]);

  return {
    loading,
    currentDate,
    currentMonth,
    today,
    myShifts,
    monthShifts,
  };
};