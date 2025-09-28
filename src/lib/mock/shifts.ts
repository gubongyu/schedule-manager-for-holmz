import { Shift } from '@/domain';

const generateShifts = (): Shift[] => {
  const shifts: Shift[] = [];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Generate shifts for current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) {
      // Weekend shifts - rotating workers
      const worker_uid = day % 2 === 0 ? 'worker1' : 'worker2';
      shifts.push({
        id: `shift-${dateString}`,
        date: dateString,
        start: '07:00',
        end: '22:00',
        worker_uid,
        isWeekend: true
      });
    } else {
      // Weekday shifts - fixed assignments
      let worker_uid: string;
      switch (dayOfWeek) {
        case 1: // Monday
          worker_uid = 'worker1';
          break;
        case 2: // Tuesday
          worker_uid = 'worker2';
          break;
        case 3: // Wednesday
          worker_uid = 'worker3';
          break;
        case 4: // Thursday
          worker_uid = 'worker4';
          break;
        case 5: // Friday
          worker_uid = 'worker5';
          break;
        default:
          worker_uid = 'worker1';
      }
      
      shifts.push({
        id: `shift-${dateString}`,
        date: dateString,
        start: '00:00',
        end: '24:00',
        worker_uid,
        isWeekend: false
      });
    }
  }
  
  return shifts;
};

export const mockShifts = generateShifts();

export const getShiftsByMonth = (month: string): Shift[] => {
  return mockShifts.filter(shift => shift.date.startsWith(month));
};

export const getShiftsByWorker = (workerId: string): Shift[] => {
  return mockShifts.filter(shift => shift.worker_uid === workerId);
};

export const getShiftByDate = (date: string): Shift | undefined => {
  return mockShifts.find(shift => shift.date === date);
};