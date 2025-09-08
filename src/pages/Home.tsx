import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BarChart3, Users, Calendar } from 'lucide-react';
import { getShiftsByWorker, getAttendanceByUser, startWork, endWork } from '@/lib/mock/attendance';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import WorkScheduleCalendar from '@/components/shared/WorkScheduleCalendar';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];
  const myShifts = user?.role === 'worker' && user ? getShiftsByWorker(user.id) : [];
  const currentAttendance = user?.role === 'worker' && user ? getAttendanceByUser(user.id, today) : null;

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

        {/* Calendar */}
        <WorkScheduleCalendar 
          userRole="worker" 
          userId={user.id} 
          myShifts={myShifts} 
        />

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

      {/* Admin Calendar */}
      <WorkScheduleCalendar userRole="admin" />

      {/* Admin Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 근무 중</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3명</div>
            <p className="text-xs text-muted-foreground">
              총 5명 중 3명이 근무 중
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대체 신청 대기</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2건</div>
            <p className="text-xs text-muted-foreground">
              승인 대기 중인 신청
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">금주 근무 예정</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15일</div>
            <p className="text-xs text-muted-foreground">
              이번 주 총 근무일
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button onClick={() => navigate('/admin/workers')} className="h-16">
          근무자 관리
        </Button>
        <Button onClick={() => navigate('/admin/requests')} className="h-16">
          대체 요청 관리
        </Button>
        <Button onClick={() => navigate('/admin/attendance')} className="h-16">
          출퇴근 기록
        </Button>
        <Button onClick={() => navigate('/admin/reports')} className="h-16">
          보고서
        </Button>
      </div>
    </div>
  );
};

export default Home;