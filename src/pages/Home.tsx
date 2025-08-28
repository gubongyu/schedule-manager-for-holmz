import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, Clock, Users } from 'lucide-react';
import { getShiftsByWorker, getShiftsByMonth, mockShifts } from '@/lib/mock/shifts';
import { getAttendanceByUser, startWork, endWork } from '@/lib/mock/attendance';
import { mockUsers } from '@/lib/mock/users';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week'>('month');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  
  const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
  const myShifts = user?.role === 'worker' && user ? getShiftsByWorker(user.id) : [];
  const monthShifts = getShiftsByMonth(currentMonth);
  const today = new Date().toISOString().split('T')[0];
  const currentAttendance = user?.role === 'worker' && user ? getAttendanceByUser(user.id, today) : null;

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

  const handleStartWork = async () => {
    if (!user) return;
    
    setIsLoading('start');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (currentAttendance?.status === 'working') {
        toast({
          variant: "destructive",
          title: "이미 처리된 상태입니다",
          description: "이미 근무를 시작했습니다."
        });
        return;
      }
      
      startWork(user.id);
      toast({
        title: "근무 시작",
        description: "근무를 시작했습니다."
      });
      
      window.location.reload();
    } finally {
      setIsLoading(null);
    }
  };

  const handleEndWork = async () => {
    if (!user) return;
    
    setIsLoading('end');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (currentAttendance?.status === 'ended') {
        toast({
          variant: "destructive",
          title: "이미 처리된 상태입니다",
          description: "이미 근무를 종료했습니다."
        });
        return;
      }
      
      if (currentAttendance?.status !== 'working') {
        toast({
          variant: "destructive",
          title: "근무를 시작해주세요",
          description: "근무 시작 후 종료할 수 있습니다."
        });
        return;
      }
      
      endWork(user.id);
      toast({
        title: "근무 종료",
        description: "근무를 종료했습니다."
      });
      
      window.location.reload();
    } finally {
      setIsLoading(null);
    }
  };

  const handleAssignWorker = () => {
    if (!selectedDate || !selectedWorker || user?.role !== 'admin') return;
    
    // In a real app, this would call an API to update the shift
    // For now, we'll just show a toast
    const worker = mockUsers.find(u => u.id === selectedWorker);
    toast({
      title: "근무자 배정 완료",
      description: `${worker?.name}님이 ${selectedDate}에 배정되었습니다.`
    });
    
    setSelectedDate(null);
    setSelectedWorker('');
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
              p-2 min-h-[80px] border border-border cursor-pointer transition-colors
              ${isCurrentMonth ? 'bg-card' : 'bg-muted/50'}
              ${isToday ? 'calendar-today' : ''}
              ${myShift && !isToday ? 'calendar-workday' : ''}
              ${isWeekend && !myShift && !monthShift ? 'calendar-weekend' : ''}
              ${user?.role === 'admin' && isCurrentMonth ? 'hover:bg-muted' : ''}
              ${selectedDate === dateString ? 'ring-2 ring-primary' : ''}
            `}
            onClick={() => {
              if (user?.role === 'admin' && isCurrentMonth) {
                setSelectedDate(dateString);
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

  if (user?.role === 'worker') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">근무 일정</h1>
          <p className="text-muted-foreground mt-2">내 근무 일정을 확인하세요</p>
        </div>

        {/* Worker Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              현재 근무 상태
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">오늘 출근 상태</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={
                    currentAttendance?.status === 'working' ? 'working' :
                    currentAttendance?.status === 'ended' ? 'ended' : 'not-started'
                  }>
                    {currentAttendance?.status === 'working' ? '근무 중' :
                     currentAttendance?.status === 'ended' ? '근무 완료' : '미출근'}
                  </Badge>
                  {currentAttendance?.startAt && (
                    <span className="text-sm text-muted-foreground">
                      출근: {currentAttendance.startAt}
                    </span>
                  )}
                  {currentAttendance?.endAt && (
                    <span className="text-sm text-muted-foreground">
                      퇴근: {currentAttendance.endAt}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar with tabs */}
        <Card>
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
                <span className="text-sm">내 근무일</span>
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
                  </div>
                </div>
                {renderCalendar()}
              </TabsContent>
              <TabsContent value="week">
                <div className="text-center py-8 text-muted-foreground">
                  주간 보기는 곧 제공될 예정입니다.
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            variant="success"
            onClick={handleStartWork}
            disabled={currentAttendance?.status === 'working' || currentAttendance?.status === 'ended' || isLoading === 'start'}
            className="h-16"
          >
            {isLoading === 'start' ? '처리 중...' : '근무 시작'}
          </Button>
          <Button 
            variant="danger"
            onClick={handleEndWork}
            disabled={currentAttendance?.status !== 'working' || isLoading === 'end'}
            className="h-16"
          >
            {isLoading === 'end' ? '처리 중...' : '근무 종료'}
          </Button>
          <Button 
            variant="secondary"
            onClick={() => navigate('/worker/substitute')}
            className="h-16"
          >
            대체 근무 요청
          </Button>
        </div>
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">관리자 근무 일정</h1>
        <p className="text-muted-foreground mt-2">전체 근무 일정을 확인하고 관리하세요</p>
      </div>

      {/* Admin Calendar with assignment */}
      <Card>
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
              <span className="text-sm">배정된 근무</span>
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
                </div>
              </div>
              {renderCalendar()}
            </TabsContent>
            <TabsContent value="week">
              <div className="text-center py-8 text-muted-foreground">
                주간 보기는 곧 제공될 예정입니다.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Worker Assignment Panel */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              근무자 배정 - {selectedDate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                  <SelectTrigger>
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
              <Button onClick={handleAssignWorker} disabled={!selectedWorker}>
                배정 확인
              </Button>
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button 
          variant="default"
          onClick={() => navigate('/admin/workers')}
          className="h-16"
        >
          근무자 관리
        </Button>
        <Button 
          variant="secondary"
          onClick={() => navigate('/admin/requests')}
          className="h-16"
        >
          대체 근무 승인
        </Button>
        <Button 
          variant="outline"
          onClick={() => navigate('/admin/attendance')}
          className="h-16"
        >
          출퇴근 기록
        </Button>
      </div>
    </div>
  );
};

export default Home;