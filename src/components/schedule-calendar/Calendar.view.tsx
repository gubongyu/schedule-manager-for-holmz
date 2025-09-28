import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Shift, Worker } from '@/domain';
import { getLocalDateKey, getLocalMonthKey } from '@/features/schedule-calendar/shared/useScheduleCalendar';

// Helper functions for rendering
const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isWithinShift = (slot: string, shift?: Shift | null) => {
  if (!shift) return false;
  const t = timeToMinutes(slot);
  return t >= timeToMinutes(shift.start) && t < timeToMinutes(shift.end);
};

const colorPalette = [
  { bg: 'bg-rose-600', text: 'text-white' }, { bg: 'bg-emerald-600', text: 'text-white' },
  { bg: 'bg-indigo-600', text: 'text-white' }, { bg: 'bg-amber-600', text: 'text-black' },
  { bg: 'bg-fuchsia-600', text: 'text-white' }, { bg: 'bg-cyan-600', text: 'text-black' },
  { bg: 'bg-sky-600', text: 'text-white' }, { bg: 'bg-lime-600', text: 'text-black' },
];

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const colorForWorker = (workerKey?: string) => {
  if (!workerKey) return colorPalette[0];
  return colorPalette[hashStr(workerKey) % colorPalette.length];
};

const generateMonthOptions = () => {
  const opts = [];
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    for (let month = 1; month <= 12; month++) {
      const value = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${year}년 ${month}월`;
      opts.push({ value, label });
    }
  }
  return opts;
};

// Props for the view component
interface CalendarViewProps {
  userRole: 'admin' | 'worker';
  currentDate: Date;
  viewType: 'month' | 'week';
  today: string;
  shiftsByMonth: Record<string, Shift[]>;
  myShifts?: Shift[];
  workers: Worker[];
  // Navigation
  goToPrevious: () => void;
  goToNext: () => void;
  handleMonthSelect: (monthKey: string) => void;
  setViewType: (view: 'month' | 'week') => void;
  // Admin specific drag handlers
  onMouseDownCell?: (date: string, time: string) => void;
  onMouseEnterCell?: (date: string, time: string) => void;
  onMouseUpGrid?: () => void;
  isDragging?: boolean;
  dragDateString?: string | null;
  dragStartTime?: string | null;
  dragEndTime?: string | null;
  // Admin specific click handlers
  onDayClick?: (date: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = (props) => {
  const { 
    userRole, currentDate, viewType, today, shiftsByMonth, myShifts = [], workers,
    goToPrevious, goToNext, handleMonthSelect, setViewType,
    onMouseDownCell = () => {}, onMouseEnterCell = () => {}, onMouseUpGrid = () => {},
    isDragging, dragDateString, dragStartTime, dragEndTime,
    onDayClick = () => {}
  } = props;

  const currentMonthKey = getLocalMonthKey(currentDate);

  const isWithinDrag = (dateString: string, slot: string) => {
    if (!isDragging || !dragDateString || dragDateString !== dateString || !dragStartTime || !dragEndTime) return false;
    const a = timeToMinutes(dragStartTime);
    const b = timeToMinutes(dragEndTime);
    const [minT, maxT] = a <= b ? [a, b] : [b, a];
    const t = timeToMinutes(slot);
    return t >= minT && t < maxT;
  };

  const renderMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks: JSX.Element[] = [];
    const monthData = shiftsByMonth[currentMonthKey] ?? [];

    for (let week = 0; week < 6; week++) {
      const weekDays: JSX.Element[] = [];
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + week * 7 + day);
        if (currentDay > lastDay && week > 3) break;

        const dateString = getLocalDateKey(currentDay);
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = dateString === today;
        const myShiftsDay = myShifts.filter(s => s.date === dateString);
        const hasMonthShift = monthData.some(s => s.date === dateString);
        const isWeekend = day === 0 || day === 6;

        weekDays.push(
          <div
            key={dateString}
            className={`relative p-2 min-h-[80px] border border-border rounded-md transition-colors 
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${myShiftsDay.length > 0 && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && myShiftsDay.length === 0 && !hasMonthShift ? 'calendar-weekend' : ''}
              ${userRole === 'admin' && isCurrentMonth ? 'cursor-pointer hover:bg-muted' : ''}
              ${isToday ? 'bg-green-200 dark:bg-green-900/50' : ''}`}
            onClick={() => userRole === 'admin' && isCurrentMonth && onDayClick(dateString)}
          >
            <div className="text-sm font-medium">{currentDay.getDate()}</div>
            {myShiftsDay.length > 0 && (
              <div className="mt-1 space-y-1">
                {myShiftsDay.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Badge variant="default" className="text-[10px]">내 근무</Badge>
                    <span className="text-xs text-muted-foreground">{s.start} - {s.end}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      if (weekDays.length > 0) weeks.push(<div key={week} className="grid grid-cols-7 gap-0">{weekDays}</div>);
    }
    return (
      <>
        <div className="grid grid-cols-7 gap-0 bg-muted">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} className="p-3 text-center text-sm font-medium border border-border">{d}</div>)}
        </div>
        {weeks}
      </>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekDays = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateString = getLocalDateKey(day);
      const monthKey = getLocalMonthKey(day);
      const monthData = shiftsByMonth[monthKey] ?? [];
      return {
        date: day,
        dateString,
        dayName: ['일', '월', '화', '수', '목', '금', '토'][i],
        isToday: dateString === today,
        assignedShifts: monthData.filter(s => s.date === dateString).map(s => ({ ...s, workerName: s.workerName ?? workers.find(w=>w.id === s.workerId)?.name ?? '미상' })),
        myShiftsDay: myShifts.filter(s => s.date === dateString),
      };
    });

    const timeSlots = Array.from({ length: 24 }).map((_, h) => `${String(h).padStart(2, '0')}:00`);

    return (
      <div className="space-y-4 select-none">
        <div className="grid grid-cols-8 gap-2">
          <div className="text-sm font-medium text-center">시간</div>
          {weekDays.map(({ date, dateString, isToday, dayName }) => (
            <div key={dateString} className={`text-sm text-center p-2 rounded ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
              <div className="font-medium">{dayName}</div>
              <div className="text-xs">{date.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="border rounded-lg overflow-x-hidden overflow-y-auto max-h-[70vh]" onMouseUp={onMouseUpGrid}>
          {timeSlots.map(time => (
            <div key={time} className="grid grid-cols-8 gap-0 border-b border-border last:border-b-0">
              <div className="p-2 bg-muted text-sm font-medium text-center border-r border-border sticky left-0 z-10">{time}</div>
              {weekDays.map(({ dateString, assignedShifts, myShiftsDay }) => {
                if (userRole === 'worker') {
                  const active = myShiftsDay.some(s => isWithinShift(time, s));
                  return (
                    <div key={`${time}-${dateString}`} className={`p-2 h-12 border-r border-border last:border-r-0 ${active ? 'bg-blue-600' : ''}`}>
                      {myShiftsDay.filter(s => time === s.start).map((s, i) => <div key={i} className="text-xs text-center text-white">내 근무</div>)}
                    </div>
                  );
                }
                // Admin view
                const matching = assignedShifts.filter(s => isWithinShift(time, s));
                let cellClass = 'p-2 h-12 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/50';
                let innerBadge: React.ReactNode = null;
                if (matching.length > 0) {
                  const s0 = matching[0];
                  const color = colorForWorker(s0.workerId || s0.workerName);
                  cellClass += ` ${color.bg} ${color.text}`;
                  if (time === s0.start) {
                    innerBadge = <Badge className="text-xs">{s0.workerName}</Badge>;
                  }
                }
                if (isWithinDrag(dateString, time)) cellClass += ' outline outline-2 outline-blue-400';

                return (
                  <div key={`${time}-${dateString}`} className={cellClass} onMouseDown={() => onMouseDownCell(dateString, time)} onMouseEnter={() => onMouseEnterCell(dateString, time)}>{innerBadge}</div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const weekMeta = useMemo(() => {
    const ref = new Date(currentDate);
    const nth = Math.floor((ref.getDate() + new Date(ref.getFullYear(), ref.getMonth(), 1).getDay() - 1) / 7) + 1;
    return `${ref.getFullYear()}년 ${ref.getMonth() + 1}월 ${nth}째 주`;
  }, [currentDate]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />근무 캘린더</CardTitle>
          <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'month' | 'week')}><TabsList>
            <TabsTrigger value="month">월간</TabsTrigger>
            <TabsTrigger value="week">주간</TabsTrigger>
          </TabsList></Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={viewType}>
          <TabsContent value="month">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={goToPrevious} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
                <Select value={currentMonthKey} onValueChange={handleMonthSelect}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{generateMonthOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={goToNext} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            {renderMonthCalendar()}
          </TabsContent>
          <TabsContent value="week">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={goToPrevious} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm text-muted-foreground">{weekMeta}</span>
                <Button variant="outline" size="sm" onClick={goToNext} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            {renderWeekView()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};