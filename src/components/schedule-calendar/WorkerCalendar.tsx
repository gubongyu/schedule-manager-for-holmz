import React from 'react';
import { useWorkerCalendar } from '@/features/schedule-calendar/worker/useWorkerCalendar';
import { CalendarView } from './Calendar.view';
import type { Shift } from '@/domain';

export const WorkerCalendar: React.FC<{ myShifts: Shift[] }> = ({ myShifts }) => {
  const hook = useWorkerCalendar(myShifts);

  return (
    <CalendarView
      userRole="worker"
      {...hook}
    />
  );
};