import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getShiftsByWorker, getShiftsByMonth } from '@/lib/mock/shifts';

const Home: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
  const myShifts = user?.role === 'worker' && user ? getShiftsByWorker(user.id) : [];
  const monthShifts = getShiftsByMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleMonthSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const [year, month] = event.target.value.split('-').map(Number);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const renderCalendar = () => {
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
        const myShift = Array.isArray(myShifts) ? myShifts.find(shift => shift.date === dateString) : null;
        const monthShift = monthShifts.find(shift => shift.date === dateString);
        const isWeekend = day === 0 || day === 6;
        
        weekDays.push(
          <div
            key={dateString}
            className={`
              p-2 min-h-[80px] border border-border
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${isToday ? 'calendar-today' : ''}
              ${myShift && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && !myShift && !monthShift ? 'calendar-weekend' : ''}
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
            {!myShift && monthShift && user?.role === 'admin' && (
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">
                  근무 배정
                </Badge>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">근무 일정</h1>
        <p className="text-muted-foreground mt-2">
          {user?.role === 'admin' ? '전체 근무 일정을 확인하세요' : '내 근무 일정을 확인하세요'}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded"></div>
          <span className="text-sm">오늘</span>
        </div>
        {user?.role === 'worker' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-calendar-workday rounded"></div>
            <span className="text-sm">내 근무일</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-calendar-weekend rounded"></div>
          <span className="text-sm">휴무일</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <select
                value={currentDate.toISOString().slice(0, 7)}
                onChange={handleMonthSelect}
                className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-0"
              >
                {generateMonthOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {renderCalendar()}
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;