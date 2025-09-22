// WorkScheduleCalendar.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { api, type Shift } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type Role = 'worker' | 'admin';

type Worker = {
  id: string;
  name: string;
  role: Role;
  department?: string;
};

interface WorkScheduleCalendarProps {
  userRole: Role;
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

  // ---- API 로드 상태 ----
  const [shiftsByMonth, setShiftsByMonth] = useState<Record<string, Shift[]>>({});
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

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
  const today = getLocalDateKey(new Date());

  // ---- 초기 로드: 근무자 목록 ----
  useEffect(() => {
    (async () => {
      try {
        const ws = await api.users.listWorkers();
        const normalized = ws.map((w: any) => ({
          id: w.id,
          name: w.name ?? w.username ?? '이름없음',
          role: w.role as Role,
          department: w.department
        })) as Worker[];
        setWorkers(normalized);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // ---- 필요한 월 데이터 로드 (월간/주간 뷰에 따라) ----
  const weekMonthKeys = useMemo(() => {
    if (viewType !== 'week') return [currentMonth];
    const startOfWeek = new Date(currentDate);
    const dow = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dow);

    const keys = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      keys.add(getLocalMonthKey(d));
    }
    return Array.from(keys);
  }, [currentDate, viewType]);

  // 월 데이터 비동기 로드 (캐시 미스만)
  useEffect(() => {
    const toLoad = weekMonthKeys.filter(k => !(k in shiftsByMonth) && !loadingMonths.has(k));
    if (toLoad.length === 0) return;

    const nextLoading = new Set(loadingMonths);
    toLoad.forEach(k => nextLoading.add(k));
    setLoadingMonths(nextLoading);

    (async () => {
      try {
        const entries = await Promise.all(
          toLoad.map(async (k) => {
            const rows = await api.shifts.getShiftsByMonth(k);
            return [k, rows] as const;
          })
        );
        setShiftsByMonth(prev => {
          const copy = { ...prev };
          for (const [k, rows] of entries) copy[k] = rows;
          return copy;
        });
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: '근무표 로드 실패', description: '시프트 데이터를 불러오지 못했습니다.' });
      } finally {
        setLoadingMonths(prev => {
          const copy = new Set(prev);
          toLoad.forEach(k => copy.delete(k));
          return copy;
        });
      }
    })();
  }, [weekMonthKeys, shiftsByMonth, loadingMonths, toast]);

  // ---- 헬퍼 ----
  const getMonthShifts = (monthKey: string) => shiftsByMonth[monthKey] ?? [];

  const findWorker = (workerId?: string) =>
    workers.find(w => w.id === workerId);

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

  // workerId → 색상 클래스 매핑
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

  // ---- 월간 모달용: 날짜별 스케줄(월 캐시 + myShifts 병합) ----
  const getShiftsByDate = (date: string): Shift[] => {
    const monthKey = date.slice(0, 7);
    const monthMatches = getMonthShifts(monthKey).filter(s => s.date === date);
    const mine = myShifts.filter(s => s.date === date);
    const all = [...monthMatches, ...mine];
    return all.map(s => {
      if (!s.workerName && s.workerId) {
        const u = findWorker(s.workerId);
        return { ...s, workerName: u?.name ?? '미상' };
      }
      return s;
    });
  };

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

  // ---- 주 단위 이동 ----
  const goToPreviousWeek = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };
  const goToNextWeek = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  // ---- 배정 저장 ----
  const handleAssignWorker = async () => {
    if (!selectedDate || !selectedWorker) return;
    if (!selectedStartTime || !selectedEndTime) {
      toast({ variant: 'destructive', title: '시간 선택 필요', description: '드래그로 시간 범위를 먼저 선택하세요.' });
      return;
    }

    // TODO: `api.shifts.assignShift` is not implemented in the backend API.
    // The following code is commented out to prevent runtime errors.
    /*
    try {
      await api.shifts.assignShift({
        date: selectedDate,
        start: selectedStartTime,
        end: selectedEndTime,
        workerId: selectedWorker,
      });

      toast({
        title: '근무자 배정 완료',
        description: `${findWorker(selectedWorker)?.name ?? selectedWorker}님이 ${selectedDate} ${selectedStartTime} - ${selectedEndTime}에 배정되었습니다.`,
      });

      // 해당 월만 재조회
      const monthKey = selectedDate.slice(0, 7);
      const fresh = await api.shifts.getShiftsByMonth(monthKey);
      setShiftsByMonth(prev => ({ ...prev, [monthKey]: fresh }));

      // 모달/선택 초기화
      setSelectedDate(null);
      setSelectedWorker('');
      setSelectedStartTime(null);
      setSelectedEndTime(null);
      setIsAssignDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '배정 실패', description: e?.message ?? '저장 중 오류가 발생했습니다.' });
    }
    */
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

    const monthData = getMonthShifts(currentMonth);

    for (let week = 0; week < 6; week++) {
      const weekDays: JSX.Element[] = [];
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + week * 7 + day);
        if (currentDay > lastDay && week > 3) break;

        const dateString = getLocalDateKey(currentDay);
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = dateString === today;

        // ✅ 하루 여러 구간 모두 가져오기
        const myShiftsDay = Array.isArray(myShifts) ? myShifts.filter(shift => shift.date === dateString) : [];
        const hasMonthShift = monthData.some(shift => shift.date === dateString);
        const isWeekend = day === 0 || day === 6;

        weekDays.push(
          <div
            key={dateString}
            className={`
              relative p-2 min-h-[80px] border border-border cursor-pointer transition-colors rounded-md
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${myShiftsDay.length > 0 && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && myShiftsDay.length === 0 && !hasMonthShift ? 'calendar-weekend' : ''}
              ${userRole === 'admin' && isCurrentMonth ? 'hover:bg-muted' : ''}
              ${isToday ? 'bg-green-200 dark:bg-green-900/50' : ''}
            `}
            onClick={() => {
              if (userRole === 'admin' && isCurrentMonth) {
                setDayModalDate(dateString);
                setIsDayModalOpen(true);
              }
            }}
          >
            <div className="text-sm font-medium">{currentDay.getDate()}</div>

            {/* ✅ 분할 근무 전부 표시 */}
            {myShiftsDay.length > 0 && (
              <div className="mt-1 space-y-1">
                {myShiftsDay.map((s, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Badge variant="default" className="text-[10px]">내 근무</Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.start} - {s.end}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
      assignedShifts: Shift[]; // 관리자용: 해당 날짜의 배정들(여러 개 가능)
      myShiftsDay: Shift[];    // ✅ 근무자용: 내 근무(분할 포함)
    };

    const weekDays: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateString = getLocalDateKey(day);
      const isToday = dateString === today;

      // 이 날짜가 속한 월의 캐시에서 배정 가져오기
      const monthKey = getLocalMonthKey(day);
      const monthData = getMonthShifts(monthKey);
      const adminShiftsRaw = monthData.filter(s => s.date === dateString);
      const adminShifts = adminShiftsRaw.map(s => {
        if (!s.workerName && s.workerId) {
          const u = findWorker(s.workerId);
          return { ...s, workerName: u?.name ?? '미상' };
        }
        return s;
      });

      const myShiftsDay = Array.isArray(myShifts) ? myShifts.filter(s => s.date === dateString) : [];

      weekDays.push({
        date: day,
        dateString,
        dayName: days[i],
        isToday,
        assignedShifts: adminShifts,
        myShiftsDay,
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

              {weekDays.map(({ dateString, assignedShifts, myShiftsDay }) => {
                // 근무자 모드: 내 어떤 구간에도 포함되면 활성화
                if (userRole === 'worker') {
                  const active = myShiftsDay.some(s => isWithinShift(time, s));
                  return (
                    <div
                      key={`${time}-${dateString}`}
                      className={`
                        p-2 h-12 border-r border-border last:border-r-0 cursor-pointer
                        hover:bg-muted/50
                        ${active ? 'bg-blue-600 text-white' : ''}
                      `}
                    >
                      {/* 각 구간 시작에 배지 표시 (여러개 가능) */}
                      {myShiftsDay
                        .filter(s => time === (s.start || '00:00'))
                        .map((s, i) => (
                          <div key={i} className="text-xs text-center">
                            <Badge variant="default" className="text-xs">내 근무</Badge>
                          </div>
                        ))}
                    </div>
                  );
                }

                // 관리자 모드: 해당 시간대에 매칭되는 배정들
                const matching = assignedShifts.filter(s => isWithinShift(time, s));
                let cellClass = 'p-2 h-12 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/50';
                let innerBadge: React.ReactNode = null;

                if (matching.length > 0) {
                  const s0 = matching[0];
                  const workerKey = s0.workerId || s0.workerName || 'unknown';
                  const color = colorForWorker(workerKey);
                  cellClass += ` ${color.bg} ${color.text}`;

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
                  {/* ✅ 주간 이동: 1주씩, 월 셀렉트 숨김 */}
                  <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* 몇월 몇째 주 */}
                  <span className="text-sm text-muted-foreground">{weekMeta.text}</span>

                  <Button variant="outline" size="sm" onClick={goToNextWeek} className="h-8 w-8 p-0">
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
                    {workers
                      .filter(w => w.role === 'worker')
                      .map(w => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}{w.department ? ` (${w.department})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>취소</Button>
                <Button onClick={handleAssignWorker} disabled={!selectedWorker || !selectedStartTime || !selectedEndTime}>
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default WorkScheduleCalendar;
