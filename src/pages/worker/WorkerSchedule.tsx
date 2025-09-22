import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Shift } from '@/lib/api/shifts';

const WorkerSchedule: React.FC = () => {
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

  const renderMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const weeks = [];
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    
    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(startDate);
        currentDay.setDate(startDate.getDate() + week * 7 + day);
        
        if (currentDay > lastDay && week > 3) break;
        
        const dateString = currentDay.toISOString().split('T')[0];
        const isCurrentMonth = currentDay.getMonth() === month;
        const isToday = dateString === today;
        const myShift = myShifts.find(shift => shift.date === dateString);
        const isWeekend = day === 0 || day === 6;
        
        weekDays.push(
          <div
            key={dateString}
            className={`
              p-2 min-h-[80px] border border-border
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${isToday ? 'calendar-today' : ''}
              ${myShift && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && !myShift ? 'calendar-weekend' : ''}
            `}
          >
            <div className="text-sm font-medium">
              {currentDay.getDate()}
            </div>
            {myShift && (
              <div className="mt-1">
                <Badge variant="default" className="text-xs">
                  내 근무
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {myShift.start} - {myShift.end}
                </div>
              </div>
            )}
          </div>
        );
      }
      if (weekDays.length > 0) {
        weeks.push(
          <div key={week} className="grid grid-cols-7 gap-0">
            {weekDays}
          </div>
        );
      }
    }
    
    return (
      <div className="space-y-0">
        <div className="grid grid-cols-7 gap-0 bg-muted">
          {days.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium border border-border">
              {day}
            </div>
          ))}
        </div>
        {weeks}
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateString = day.toISOString().split('T')[0];
      const myShift = myShifts.find(shift => shift.date === dateString);
      const isToday = dateString === today;
      
      weekDays.push({
        date: day,
        dateString,
        shift: myShift,
        isToday
      });
    }
    
    return (
      <div className="space-y-4">
        {weekDays.map(({ date, dateString, shift, isToday }) => (
          <Card key={dateString} className={isToday ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">
                    {date.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' })}
                    {isToday && <Badge variant="default" className="ml-2">오늘</Badge>}
                  </h3>
                </div>
                <div>
                  {shift ? (
                    <div className="text-right">
                      <Badge variant="approved">근무일</Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        {shift.start} - {shift.end}
                      </div>
                    </div>
                  ) : (
                    <Badge variant="ended">휴무</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">근무 일정을 불러오는 중...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">내 근무 일정</h1>
        <p className="text-muted-foreground mt-2">
          {currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 일정
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded"></div>
          <span className="text-sm">오늘</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-calendar-workday rounded"></div>
          <span className="text-sm">내 근무일</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-calendar-weekend rounded"></div>
          <span className="text-sm">휴무일</span>
        </div>
      </div>

      <Tabs defaultValue="month" className="space-y-6">
        <TabsList>
          <TabsTrigger value="month">월간</TabsTrigger>
          <TabsTrigger value="week">주간</TabsTrigger>
        </TabsList>
        
        <TabsContent value="month">
          <Card>
            <CardHeader>
              <CardTitle>월간 일정</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMonthCalendar()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="week">
          <div>
            <h2 className="text-xl font-semibold mb-4">주간 일정</h2>
            {renderWeekView()}
          </div>
        </TabsContent>
      </Tabs>

      {myShifts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">등록된 근무가 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkerSchedule;