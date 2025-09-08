import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { getShiftsByMonth } from '@/lib/mock/shifts';
import { mockUsers } from '@/lib/mock/users';
import { toast } from '@/hooks/use-toast';

interface Shift {
  date: string;   // 'YYYY-MM-DD'
  start: string;  // 'HH:MM'
  end: string;    // 'HH:MM'
  workerId?: string;
  workerName?: string;
}

interface WorkScheduleCalendarProps {
  userRole: 'worker' | 'admin';
  userId?: string;
  myShifts?: Shift[];
  className?: string;
}

const WorkScheduleCalendar: React.FC<WorkScheduleCalendarProps> = ({
  userRole,
  userId,
  myShifts = [],
  className
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week'>('month');

  // 주간 드래그 배정 모달
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);

  // 월간 관리자: 일일 스케줄 모달
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

  // 주간 드래그 상태 (admin)
  const [isDragging, setIsDragging] = useState(false);
  const [dragDateString, setDragDateString] = useState<string | null>(null);
  const [dragStartTime, setDragStartTime] = useState<string | null>(null);
  const [dragEndTime, setDragEndTime] = useState<string | null>(null);

  // === 로컬 타임존 안전 키 ===
  const getLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const getLocalMonthKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const currentMonth = getLocalMonthKey(currentDate);
  const monthShifts = getShiftsByMonth(currentMonth) as Shift[];
  const today = getLocalDateKey(new Date());

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const handleMonthSelect = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // === 유틸 ===
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const isWithinShift = (slot: string, shift?: Shift | null) => {
    if (!shift) return false;
    const t = timeToMinutes(slot);
    return t >= timeToMinutes(shift.start) && t < timeToMinutes(shift.end);
  };
  const isWithinDrag = (dateString: string, slot: string) => {
    if (!isDragging || !dragDateString || dragDateString !== dateString || !dragStartTime || !dragEndTime) return false;
    const a = timeToMinutes(dragStartTime);
    const b = timeToMinutes(dragEndTime);
    const [minT, maxT] = a <= b ? [a, b] : [b, a];
    const t = timeToMinutes(slot);
    return t >= minT && t < maxT; // [start, end)
  };

  // workerId → 색상 클래스 매핑 (고정 팔레트)
  const colorPalette = [
    { bg: 'bg-rose-600', light: 'bg-rose-500/25', text: 'text-white' },
    { bg: 'bg-emerald-600', light: 'bg-emerald-500/25', text: 'text-white' },
    { bg: 'bg-indigo-600', light: 'bg-indigo-500/25', text: 'text-white' },
    { bg: 'bg-amber-600', light: 'bg-amber-500/25', text: 'text-black' },
    { bg: 'bg-fuchsia-600', light: 'bg-fuchsia-500/25', text: 'text-white' },
    { bg: 'bg-cyan-600', light: 'bg-cyan-500/25', text: 'text-black' },
    { bg: 'bg-sky-600', light: 'bg-sky-500/25', text: 'text-white' },
    { bg: 'bg-lime-600', light: 'bg-lime-500/25', text: 'text-black' },
  ];
  const hashStr = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };
  const colorForWorker = (workerKey?: string) => {
    if (!workerKey) return colorPalette[0];
    const idx = hashStr(workerKey) % colorPalette.length;
    return colorPalette[idx];
  };

  // 월간 일일 모달용: 날짜별 스케줄
  const getShiftsByDate = (date: string): Shift[] => {
    const monthMatches = monthShifts.filter(s => s.date === date);
    const mine = myShifts.filter(s => s.date === date);
    const all = [...monthMatches, ...mine];
    return all.map(s => {
      if (!s.workerName && s.workerId) {
        const u = mockUsers.find(mu => mu.id === s.workerId);
        return { ...s, workerName: u?.name ?? '미상' };
      }
      return s;
    });
  };

  const handleAssignWorker = () => {
    if (!selectedDate || !selectedWorker || userRole !== 'admin') return;
    const worker = mockUsers.find(u => u.id === selectedWorker);
    const timeLabel = selectedStartTime && selectedEndTime ? `${selectedStartTime} - ${selectedEndTime}` : '시간 미지정';
    toast({
      title: '근무자 배정 완료',
      description: `${worker?.name}님이 ${selectedDate} ${timeLabel}에 배정되었습니다.`,
    });
    setSelectedDate(null);
    setSelectedWorker('');
    setSelectedStartTime(null);
    setSelectedEndTime(null);
    setIsAssignDialogOpen(false);
  };

  // === 월간 ===
  const renderMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks: JSX.Element[] = [];
    const days = ['일', '월', '화', '수', '목', '금', '토'];

    for (let week = 0; week < 6; week++) {
      const weekDays: JSX.Element[] = [];
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + week * 7 + day);
        if (currentDay > lastDay && week > 3) break;

        const dateString = getLocalDateKey(currentDay);
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = dateString === today;
        const myShift = Array.isArray(myShifts) ? myShifts.find(shift => shift.date === dateString) : null;
        const monthShift = monthShifts.find(shift => shift.date === dateString);
        const isWeekend = day === 0 || day === 6;

        weekDays.push(
          <div
            key={dateString}
            className={`
              relative p-2 min-h-[80px] border border-border cursor-pointer transition-colors rounded-md
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${myShift && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && !myShift && !monthShift ? 'calendar-weekend' : ''}
              ${userRole === 'admin' && isCurrentMonth ? 'hover:bg-muted' : ''}
              ${isToday ? 'bg-green-200 dark:bg-green-900/50' : ''} /* 오늘: 녹색 배경 */
            `}
            onClick={() => {
              if (userRole === 'admin' && isCurrentMonth) {
                setDayModalDate(dateString);
                setIsDayModalOpen(true);
              }
            }}
          >
            <div className="text-sm font-medium">{currentDay.getDate()}</div>

            {myShift && (
              <div className="mt-1">
                <Badge variant="default" className="text-xs">내 근무</Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {myShift.start} - {myShift.end}
                </div>
              </div>
            )}
            {/* 관리자 월간 배정 배지는 제거 */}
          </div>
        );
      }
      if (weekDays.length > 0) {
        weeks.push(<div key={week} className="grid grid-cols-7 gap-0">{weekDays}</div>);
      }
    }

    return (
      <div className="space-y-0">
        <div className="grid grid-cols-7 gap-0 bg-muted">
          {days.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium border border-border">{day}</div>
          ))}
        </div>
        {weeks}
      </div>
    );
  };

  // === 주차 정보 ===
  const weekMeta = useMemo(() => {
    const ref = new Date(currentDate);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const dom = ref.getDate();
    const firstOfMonth = new Date(year, month, 1);
    const firstDow = firstOfMonth.getDay();
    const nth = Math.floor((dom + firstDow - 1) / 7) + 1;
    return { year, text: `${year}년 ${month + 1}월 ${nth}째 주` };
  }, [currentDate]);

  // === 주간 ===
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const days = ['일', '월', '화', '수', '목', '금', '토'];

    type WeekDay = {
      date: Date;
      dateString: string;
      dayName: string;
      isToday: boolean;
      // 관리자용: 해당 날짜의 모든 배정(여러 개 가능)
      assignedShifts: Shift[];
      // 근무자용: 내 근무(있다면 1개 가정)
      myShift?: Shift | null;
    };

    const weekDays: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateString = getLocalDateKey(day);
      const isToday = dateString === today;

      // 관리자: 그 날짜의 모든 배정 가져오기
      const adminShiftsRaw = (getShiftsByMonth(getLocalMonthKey(day)) as Shift[]).filter(s => s.date === dateString);
      const adminShifts = adminShiftsRaw.map(s => {
        if (!s.workerName && s.workerId) {
          const u = mockUsers.find(mu => mu.id === s.workerId);
          return { ...s, workerName: u?.name ?? '미상' };
        }
        return s;
      });

      // 근무자: 내 근무 1개(있을 수도/없을 수도)
      const myShift = Array.isArray(myShifts) ? myShifts.find(s => s.date === dateString) : null;

      weekDays.push({
        date: day,
        dateString,
        dayName: days[i],
        isToday,
        assignedShifts: adminShifts,
        myShift,
      });
    }

    // 24시간 슬롯
    const timeSlots: string[] = [];
    for (let h = 0; h < 24; h++) timeSlots.push(`${h.toString().padStart(2, '0')}:00`);

    // 드래그 핸들러(admin)
    const onMouseDownCell = (dateString: string, time: string) => {
      if (userRole !== 'admin') return;
      setIsDragging(true);
      setDragDateString(dateString);
      setDragStartTime(time);
      setDragEndTime(time);
    };
    const onMouseEnterCell = (dateString: string, time: string) => {
      if (!isDragging || userRole !== 'admin') return;
      if (dateString !== dragDateString) return; // 하루 내 드래그만
      setDragEndTime(time);
    };
    const onMouseUpGrid = () => {
      if (!isDragging || userRole !== 'admin') return;
      setIsDragging(false);
      if (!dragDateString || !dragStartTime || !dragEndTime) {
        setDragDateString(null); setDragStartTime(null); setDragEndTime(null);
        return;
      }
      const a = timeToMinutes(dragStartTime);
      const b = timeToMinutes(dragEndTime);
      const startT = a <= b ? dragStartTime : dragEndTime;
      const endT   = a <= b ? dragEndTime   : dragStartTime;

      setSelectedDate(dragDateString);
      setSelectedStartTime(startT);
      setSelectedEndTime(endT);
      setIsAssignDialogOpen(true);

      setDragDateString(null);
      setDragStartTime(null);
      setDragEndTime(null);
    };

    return (
      <div className="space-y-4 select-none">
        {/* 헤더 */}
        <div className="grid grid-cols-8 gap-2">
          <div className="text-sm font-medium text-center">시간</div>
          {weekDays.map(({ date, dateString, isToday, dayName }) => (
            <div
              key={dateString}
              className={`text-sm text-center p-2 rounded ${isToday ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <div className="font-medium">{dayName}</div>
              <div className="text-xs">{date.getDate()}</div>
            </div>
          ))}
        </div>

        {/* 본문 */}
        <div className="border rounded-lg overflow-x-hidden overflow-y-auto max-h-[70vh]" onMouseUp={onMouseUpGrid}>
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-8 gap-0 border-b border-border last:border-b-0">
              <div className="p-2 bg-muted text-sm font-medium text-center border-r border-border sticky left-0 z-10">
                {time}
              </div>

              {weekDays.map(({ dateString, assignedShifts, myShift }) => {
                // 근무자 모드: 기존 파랑 처리 유지
                if (userRole === 'worker') {
                  const active = isWithinShift(time, myShift || undefined);
                  return (
                    <div
                      key={`${time}-${dateString}`}
                      className={`
                        p-2 h-12 border-r border-border last:border-r-0 cursor-pointer
                        hover:bg-muted/50
                        ${active ? 'bg-blue-600 text-white' : ''}
                      `}
                    >
                      {myShift && time === (myShift.start || '00:00') && (
                        <div className="text-xs text-center">
                          <Badge variant="default" className="text-xs">내 근무</Badge>
                        </div>
                      )}
                    </div>
                  );
                }

                // 관리자 모드: 해당 시간대에 매칭되는 배정들
                const matching = assignedShifts.filter(s => isWithinShift(time, s));
                let cellClass = 'p-2 h-12 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/50';

                // 기본 배경: 드래그 중이면 outline로 표시
                let innerBadge: React.ReactNode = null;

                if (matching.length > 0) {
                  // 첫 번째 근무자 색상으로 칠함
                  const s0 = matching[0];
                  const workerKey = s0.workerId || s0.workerName || 'unknown';
                  const color = colorForWorker(workerKey);
                  cellClass += ` ${color.bg} ${color.text}`;

                  // 시작 슬롯이면 이름 배지 + 동시 배정 카운트
                  if (time === (s0.start || '00:00')) {
                    innerBadge = (
                      <div className="flex items-center justify-center gap-1">
                        <Badge className="text-xs">{s0.workerName ?? s0.workerId ?? '근무자'}</Badge>
                        {matching.length > 1 && (
                          <Badge variant="outline" className="text-[10px] bg-white/20 border-white/50">
                            +{matching.length - 1}
                          </Badge>
                        )}
                      </div>
                    );
                  }
                }

                // 드래그 강조 (색 위에 외곽선)
                const dragActive = isWithinDrag(dateString, time);
                if (dragActive) {
                  cellClass += ' outline outline-2 outline-blue-400';
                }

                return (
                  <div
                    key={`${time}-${dateString}`}
                    className={cellClass}
                    onMouseDown={() => onMouseDownCell(dateString, time)}
                    onMouseEnter={() => onMouseEnterCell(dateString, time)}
                  >
                    {innerBadge}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      for (let month = 1; month <= 12; month++) {
        const value = `${year}-${month.toString().padStart(2, '0')}`;
        const label = `${year}년 ${month}월`;
        options.push({ value, label });
      }
    }
    return options;
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              근무 캘린더
            </CardTitle>
            <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'month' | 'week')}>
              <TabsList>
                <TabsTrigger value="month">월간</TabsTrigger>
                <TabsTrigger value="week">주간</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 dark:bg-green-900/50 rounded" />
              <span className="text-sm">오늘</span>
            </div>
            {userRole === 'worker' ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded" />
                <span className="text-sm">내 근무시간</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-rose-600 rounded" />
                <div className="w-4 h-4 bg-emerald-600 rounded" />
                <div className="w-4 h-4 bg-indigo-600 rounded" />
                <span className="text-sm">배정 근무시간(근무자별 색상)</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-calendar-weekend rounded" />
              <span className="text-sm">휴무일</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={viewType}>
            {/* 월간 */}
            <TabsContent value="month">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={goToPreviousMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Select value={getLocalMonthKey(currentDate)} onValueChange={handleMonthSelect}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="sm" onClick={goToNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {renderMonthCalendar()}
            </TabsContent>

            {/* 주간 */}
            <TabsContent value="week">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={goToPreviousMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Select value={getLocalMonthKey(currentDate)} onValueChange={handleMonthSelect}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* 몇월 몇째 주 */}
                  <span className="text-sm text-muted-foreground">{weekMeta.text}</span>

                  <Button variant="outline" size="sm" onClick={goToNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {renderWeekView()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 월간(관리자) — 일일 스케줄 모달 */}
      {userRole === 'admin' && (
        <Dialog open={isDayModalOpen} onOpenChange={setIsDayModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>당일 근무 스케줄 - {dayModalDate}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {dayModalDate && getShiftsByDate(dayModalDate).length > 0 ? (
                <div className="divide-y border rounded-md">
                  {getShiftsByDate(dayModalDate).map((s, idx) => (
                    <div key={`${s.date}-${s.start}-${idx}`} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {s.start} - {s.end}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.workerName ?? s.workerId ?? '미배정'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">배정된 근무가 없습니다.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 주간(관리자) — 드래그 배정 모달 */}
      {userRole === 'admin' && (
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                근무자 배정 - {selectedDate}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">날짜</label>
                  <div className="mt-1 p-2 bg-muted rounded text-sm">{selectedDate}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">시간</label>
                  <div className="mt-1 p-2 bg-muted rounded text-sm">
                    {selectedStartTime && selectedEndTime
                      ? `${selectedStartTime} - ${selectedEndTime}`
                      : '시간을 드래그로 선택하세요'}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">근무자 선택</label>
                <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="근무자를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockUsers.filter(u => u.role === 'worker').map(worker => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} ({worker.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>취소</Button>
                <Button onClick={handleAssignWorker} disabled={!selectedWorker}>저장</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default WorkScheduleCalendar;
