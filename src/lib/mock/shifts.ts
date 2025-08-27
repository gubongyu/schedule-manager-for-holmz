import { Shift } from '@/types';

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
      const workerId = day % 2 === 0 ? 'worker1' : 'worker2';
      shifts.push({
        id: `shift-${dateString}`,
        date: dateString,
        start: '07:00',
        end: '22:00',
        workerId,
        isWeekend: true
      });
    } else {
      // Weekday shifts - fixed assignments
      let workerId: string;
      switch (dayOfWeek) {
        case 1: // Monday
          workerId = 'worker1';
          break;
        case 2: // Tuesday
          workerId = 'worker2';
          break;
        case 3: // Wednesday
          workerId = 'worker3';
          break;
        case 4: // Thursday
          workerId = 'worker4';
          break;
        case 5: // Friday
          workerId = 'worker5';
          break;
        default:
          workerId = 'worker1';
      }
      
      shifts.push({
        id: `shift-${dateString}`,
        date: dateString,
        start: '07:00',
        end: '22:00',
        workerId,
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
  return mockShifts.filter(shift => shift.workerId === workerId);
};

export const getShiftByDate = (date: string): Shift | undefined => {
  return mockShifts.find(shift => shift.date === date);
};