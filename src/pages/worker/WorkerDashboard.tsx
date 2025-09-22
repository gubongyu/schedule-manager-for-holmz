import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useWorkerDashboard } from '@/hooks/useWorkerDashboard';

const WorkerDashboard: React.FC = () => {
  const { user, attendance, loading, err, busy, startWork, endWork } = useWorkerDashboard();
  const navigate = useNavigate();

  const quickActions = [
    {
      title: '시간표 확인',
      description: '내 근무 일정을 확인하세요',
      action: () => navigate('/worker/schedule'),
      variant: 'default' as const,
      disabled: false,
      loading: false,
    },
    {
      title: '대체 근무자 요청',
      description: '대체 근무를 요청하거나 신청하세요',
      action: () => navigate('/worker/substitute'),
      variant: 'secondary' as const,
      disabled: false,
      loading: false,
    },
    {
      title: '근무 시작',
      description: '오늘 근무를 시작하세요',
      action: startWork,
      variant: 'success' as const,
      disabled: attendance?.status === 'working' || attendance?.status === 'ended',
      loading: busy === 'start',
    },
    {
      title: '근무 종료',
      description: '오늘 근무를 종료하세요',
      action: endWork,
      variant: 'danger' as const,
      disabled: attendance?.status !== 'working',
      loading: busy === 'end',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{user?.name}님의 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          오늘 {new Date().toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
          })}
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>현재 근무 상태</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : err ? (
            <div className="text-sm text-destructive">{err}</div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">오늘 출근 상태</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge
                    variant={
                      attendance?.status === 'working' ? 'working' :
                      attendance?.status === 'ended' ? 'ended' : 'not-started'
                    }
                  >
                    {attendance?.status === 'working' ? '근무 중' :
                     attendance?.status === 'ended' ? '근무 완료' : '미출근'}
                  </Badge>
                  {attendance?.startAt && (
                    <span className="text-sm text-muted-foreground">출근: {attendance.startAt}</span>
                  )}
                  {attendance?.endAt && (
                    <span className="text-sm text-muted-foreground">퇴근: {attendance.endAt}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">빠른 액션</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action, i) => (
            <Card key={i} className="action-card">
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
