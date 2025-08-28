import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { getShiftsByMonth, mockShifts } from '@/lib/mock/shifts';
import { mockUsers } from '@/lib/mock/users';
import { toast } from '@/hooks/use-toast';

interface WorkScheduleCalendarProps {
  userRole: 'worker' | 'admin';
  userId?: string;
  myShifts?: any[];
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  
  const currentMonth = currentDate.toISOString().slice(0, 7);
  const monthShifts = getShiftsByMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];

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

  const handleAssignWorker = () => {
    if (!selectedDate || !selectedWorker || userRole !== 'admin') return;
    
    const worker = mockUsers.find(u => u.id === selectedWorker);
    toast({
      title: "근무자 배정 완료",
      description: `${worker?.name}님이 ${selectedDate}에 배정되었습니다.`
    });
    
    setSelectedDate(null);
    setSelectedWorker('');
    setIsAssignDialogOpen(false);
  };

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
        const myShift = Array.isArray(myShifts) ? myShifts.find(shift => shift.date === dateString) : null;
        const monthShift = monthShifts.find(shift => shift.date === dateString);
        const isWeekend = day === 0 || day === 6;
        
        weekDays.push(
          <div
            key={dateString}
            className={`
              p-2 min-h-[80px] border border-border cursor-pointer transition-colors
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${isToday ? 'calendar-today' : ''}
              ${myShift && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && !myShift && !monthShift ? 'calendar-weekend' : ''}
              ${userRole === 'admin' && isCurrentMonth ? 'hover:bg-muted' : ''}
              ${selectedDate === dateString ? 'ring-2 ring-primary' : ''}
            `}
            onClick={() => {
              if (userRole === 'admin' && isCurrentMonth) {
                setSelectedDate(dateString);
                setIsAssignDialogOpen(true);
              }
            }}
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
            {!myShift && monthShift && userRole === 'admin' && (
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

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    const weekDays = [];
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dateString = day.toISOString().split('T')[0];
      const myShift = Array.isArray(myShifts) ? myShifts.find(shift => shift.date === dateString) : null;
      const monthShift = monthShifts.find(shift => shift.date === dateString);
      const isToday = dateString === today;
      
      weekDays.push({
        date: day,
        dateString,
        shift: myShift || monthShift,
        isToday,
        dayName: days[i]
      });
    }
    
    const timeSlots = [];
    for (let hour = 7; hour <= 22; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-8 gap-2">
          <div className="text-sm font-medium text-center">시간</div>
          {weekDays.map(({ date, dateString, isToday, dayName }) => (
            <div key={dateString} className={`text-sm text-center p-2 rounded ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
              <div className="font-medium">{dayName}</div>
              <div className="text-xs">{date.getDate()}</div>
            </div>
          ))}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          {timeSlots.map(time => (
            <div key={time} className="grid grid-cols-8 gap-0 border-b border-border last:border-b-0">
              <div className="p-2 bg-muted text-sm font-medium text-center border-r border-border">
                {time}
              </div>
              {weekDays.map(({ dateString, shift }) => (
                <div 
                  key={`${time}-${dateString}`}
                  className={`p-2 h-12 border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/50 ${
                    shift ? 'bg-calendar-workday/20' : ''
                  }`}
                  onClick={() => {
                    if (userRole === 'admin') {
                      setSelectedDate(dateString);
                      setIsAssignDialogOpen(true);
                    }
                  }}
                >
                  {shift && time === '07:00' && (
                    <div className="text-xs text-center">
                      <Badge variant="default" className="text-xs">
                        {userRole === 'worker' ? '내 근무' : '근무'}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
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
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded"></div>
              <span className="text-sm">오늘</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-calendar-workday rounded"></div>
              <span className="text-sm">{userRole === 'worker' ? '내 근무일' : '배정된 근무'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-calendar-weekend rounded"></div>
              <span className="text-sm">휴무일</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewType}>
            <TabsContent value="month">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Select value={currentDate.toISOString().slice(0, 7)} onValueChange={handleMonthSelect}>
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
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {renderMonthCalendar()}
            </TabsContent>
            <TabsContent value="week">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Select value={currentDate.toISOString().slice(0, 7)} onValueChange={handleMonthSelect}>
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
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextMonth}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {renderWeekView()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Admin Assignment Dialog */}
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
                  <div className="mt-1 p-2 bg-muted rounded text-sm">
                    {selectedDate}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">시간</label>
                  <div className="mt-1 p-2 bg-muted rounded text-sm">
                    07:00 - 22:00
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
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleAssignWorker} disabled={!selectedWorker}>
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