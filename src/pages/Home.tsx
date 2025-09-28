import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BarChart3, Users } from 'lucide-react';
import { AdminCalendar } from '@/components/schedule-calendar/AdminCalendar';
import { WorkerCalendar } from '@/components/schedule-calendar/WorkerCalendar';
import { useHome } from '@/features/dashboard/useHome';

import { useAuth } from '@/contexts/AuthContext';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    busy,
    workerState,
    adminState,
    handleStartWork,
    handleEndWork,
  } = useHome();

  if (user?.role === 'worker') {
    const { att, myShifts, loading, err } = workerState;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">근무 일정</h1>
          <p className="text-muted-foreground mt-2">내 근무 일정을 확인하세요</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              현재 근무 상태
            </CardTitle>
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
                        att?.status === 'working' ? 'working' :
                        att?.status === 'ended' ? 'ended' : 'not-started'
                      }
                    >
                      {att?.status === 'working' ? '근무 중' :
                       att?.status === 'ended' ? '근무 완료' : '미출근'}
                    </Badge>
                    {att?.start_at && <span className="text-sm text-muted-foreground">출근: {att.start_at}</span>}
                    {att?.end_at && <span className="text-sm text-muted-foreground">퇴근: {att.end_at}</span>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <WorkerCalendar myShifts={workerState.myShifts} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="success"
            onClick={handleStartWork}
            disabled={att?.status === 'working' || att?.status === 'ended' || busy === 'start' || loading}
            className="h-16"
          >
            {busy === 'start' ? '처리 중...' : '근무 시작'}
          </Button>
          <Button
            variant="danger"
            onClick={handleEndWork}
            disabled={att?.status !== 'working' || busy === 'end' || loading}
            className="h-16"
          >
            {busy === 'end' ? '처리 중...' : '근무 종료'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/worker/substitute')}
            className="h-16"
          >
            대체 근무 요청
          </Button>
          <Button
            onClick={() => navigate('/worker/work-log')}
            className="h-16"
          >
            업무 기록
          </Button>
        </div>
      </div>
    );
  }

  // Admin view
  const { loading, err, todayWorkingCount, pendingSubs, weekShiftDays } = adminState;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">관리자 근무 일정</h1>
        <p className="text-muted-foreground mt-2">전체 근무 일정을 확인하고 관리하세요</p>
      </div>

      <AdminCalendar />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 근무 중</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : err ? (
              <div className="text-sm text-destructive">{err}</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{todayWorkingCount}명</div>
                <p className="text-xs text-muted-foreground">현재 근무 중</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대체 신청 대기</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : err ? (
              <div className="text-sm text-destructive">{err}</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{pendingSubs}건</div>
                <p className="text-xs text-muted-foreground">승인 대기 중인 신청</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">금주 근무 예정</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : err ? (
              <div className="text-sm text-destructive">{err}</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{weekShiftDays}일</div>
                <p className="text-xs text-muted-foreground">이번 주 총 근무일</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Button variant="default" onClick={() => navigate('/admin/workers')} className="h-16">
          근무자 관리
        </Button>
        <Button variant="secondary" onClick={() => navigate('/admin/requests')} className="h-16">
          대체 요청 관리
        </Button>
        <Button variant="default" onClick={() => navigate('/admin/attendance')} className="h-16">
          출퇴근 기록
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/reports')} className="h-16">
          월별 근무시간 보고서
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/reports/work-log')} className="h-16">
          업무 기록 보고서
        </Button>
      </div>
    </div>
  );
};

export default Home;
