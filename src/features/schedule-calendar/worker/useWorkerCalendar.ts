import { useScheduleCalendar } from '../shared/useScheduleCalendar';
import type { Shift } from '@/domain';

export const useWorkerCalendar = (myShifts: Shift[]) => {
  const shared = useScheduleCalendar();

  return {
    ...shared,
    myShifts,
  };
};