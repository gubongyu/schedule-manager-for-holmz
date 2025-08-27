import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { mockSubstitutions } from '@/lib/mock/substitutions';
import { getTodayAttendance } from '@/lib/mock/attendance';
import { getShiftsByMonth } from '@/lib/mock/shifts';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Calculate stats
  const todayAttendance = getTodayAttendance();
  const workingToday = todayAttendance.filter(att => att.status === 'working').length;
  const pendingRequests = mockSubstitutions.filter(req => req.status === 'pending').length;
  
  // Get this week's shifts count
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay());
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  
  const weeklyShifts = getShiftsByMonth(currentMonth).filter(shift => {
    const shiftDate = new Date(shift.date);
    return shiftDate >= currentWeekStart && shiftDate <= currentWeekEnd;
  });

  const stats = [
    {
      title: '오늘 근무 중',
      value: workingToday,
      unit: '명',
      description: '현재 근무 중인 직원 수',
      color: 'text-success'
    },
    {
      title: '대체 신청 대기',
      value: pendingRequests,
      unit: '건',
      description: '승인 대기 중인 요청',
      color: 'text-warning'
    },
    {
      title: '금주 근무 예정',
      value: weeklyShifts.length,
      unit: '건',
      description: '이번 주 총 근무 스케줄',
      color: 'text-primary'
    }
  ];

  const quickActions = [
    {
      title: '근무자 관리',
      description: '근무자 추가/삭제 및 정보 관리',
      action: () => navigate('/admin/workers'),
      variant: 'default' as const
    },
    {
      title: '대체 근무 승인',
      description: '대체 근무 요청 검토 및 승인',
      action: () => navigate('/admin/requests'),
      variant: 'secondary' as const,
      badge: pendingRequests > 0 ? pendingRequests : undefined
    },
    {
      title: '출퇴근 기록',
      description: '근무자별 출퇴근 현황 확인',
      action: () => navigate('/admin/attendance'),
      variant: 'outline' as const
    }
  ];

  const recentRequests = mockSubstitutions
    .filter(req => req.status === 'pending')
    .slice(0, 3);

  const recentAttendance = todayAttendance.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          근무 시간 관리 시스템 현황을 확인하세요
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stat.unit}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">관리 메뉴</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <Card key={index} className="action-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg">{action.title}</h3>
                  {action.badge && (
                    <Badge variant="pending">{action.badge}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {action.description}
                </p>
                <Button 
                  variant={action.variant}
                  onClick={action.action}
                  className="w-full"
                >
                  {action.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <Card>
          <CardHeader>
            <CardTitle>최근 대체 근무 요청</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRequests.length > 0 ? (
              <div className="space-y-4">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{request.ownerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.date} · {request.timeRange}
                      </p>
                    </div>
                    <Badge variant="pending">승인 대기</Badge>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/admin/requests')}
                >
                  모든 요청 보기
                </Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                대기 중인 요청이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>오늘 출근 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAttendance.length > 0 ? (
              <div className="space-y-4">
                {recentAttendance.map((attendance) => (
                  <div key={attendance.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{attendance.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        {attendance.startAt ? `출근: ${attendance.startAt}` : '미출근'}
                      </p>
                    </div>
                    <Badge variant={
                      attendance.status === 'working' ? 'working' :
                      attendance.status === 'ended' ? 'ended' : 'not-started'
                    }>
                      {attendance.status === 'working' ? '근무 중' :
                       attendance.status === 'ended' ? '종료' : '미시작'}
                    </Badge>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate('/admin/attendance')}
                >
                  전체 출근 기록 보기
                </Button>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                오늘 출근 기록이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;