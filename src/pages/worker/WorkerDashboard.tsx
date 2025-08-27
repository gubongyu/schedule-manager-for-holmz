import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { startWork, endWork, getAttendanceByUser } from '@/lib/mock/attendance';
import { useNavigate } from 'react-router-dom';

const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const currentAttendance = user ? getAttendanceByUser(user.id, today) : null;

  const handleStartWork = async () => {
    if (!user) return;
    
    setIsLoading('start');
    try {
      // Simulate API delay
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
      
      // Force re-render by navigating to the same route
      window.location.reload();
    } finally {
      setIsLoading(null);
    }
  };

  const handleEndWork = async () => {
    if (!user) return;
    
    setIsLoading('end');
    try {
      // Simulate API delay
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
      
      // Force re-render by navigating to the same route
      window.location.reload();
    } finally {
      setIsLoading(null);
    }
  };

  const quickActions = [
    {
      title: '시간표 확인',
      description: '내 근무 일정을 확인하세요',
      action: () => navigate('/worker/schedule'),
      variant: 'default' as const
    },
    {
      title: '대체 근무자 요청',
      description: '대체 근무를 요청하거나 신청하세요',
      action: () => navigate('/worker/substitute'),
      variant: 'secondary' as const
    },
    {
      title: '근무 시작',
      description: '오늘 근무를 시작하세요',
      action: handleStartWork,
      variant: 'success' as const,
      disabled: currentAttendance?.status === 'working' || currentAttendance?.status === 'ended',
      loading: isLoading === 'start'
    },
    {
      title: '근무 종료',
      description: '오늘 근무를 종료하세요',
      action: handleEndWork,
      variant: 'danger' as const,
      disabled: currentAttendance?.status !== 'working',
      loading: isLoading === 'end'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{user?.name}님의 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          오늘 {new Date().toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
          })}
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>현재 근무 상태</CardTitle>
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

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="action-card">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2">{action.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{action.description}</p>
                <Button 
                  variant={action.variant}
                  onClick={action.action}
                  disabled={action.disabled || action.loading}
                  className="w-full"
                >
                  {action.loading ? '처리 중...' : action.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;