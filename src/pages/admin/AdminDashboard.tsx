import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminDashboard } from '@/features/dashboard/admin/useAdminDashboard';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    loading,
    err,
    todayKey,
    totalProfiles,
    todayAttendance,
    pendingSubs,
    todayAssignedCount,
    todayUnassignedCount,
    stats,
    profileMap,
  } = useAdminDashboard();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          오늘({new Date(todayKey).toLocaleDateString('ko-KR')})의 현황 요약입니다.
        </p>
      </div>

      {/* Quick Actions */}
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

      {/* 오류/로딩 */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">불러오는 중...</CardContent>
        </Card>
      ) : err ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">{err}</CardContent>
        </Card>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-primary">{totalProfiles}</p>
                <p className="text-sm text-muted-foreground">총 프로필</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-success">{stats.working}</p>
                <p className="text-sm text-muted-foreground">근무 중(오늘)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats.ended}</p>
                <p className="text-sm text-muted-foreground">퇴근 완료(오늘)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-warning">{pendingSubs}</p>
                <p className="text-sm text-muted-foreground">대체요청 대기</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-foreground">{todayAssignedCount}/{todayAssignedCount + todayUnassignedCount}</p>
                <p className="text-sm text-muted-foreground">오늘 배정/전체 시프트</p>
              </CardContent>
            </Card>
          </div>

          {/* Latest Attendance Today */}
          <div>
            <h2 className="text-xl font-semibold mb-4">오늘 최신 출퇴근</h2>
            {todayAttendance.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">기록이 없습니다.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {todayAttendance.slice(0, 5).map((att) => (
                  <Card key={att.id ?? `${att.user_uid}-${att.date}`}>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                        <div className="col-span-2">
                          <h3 className="font-medium">{profileMap.get(att.user_uid)?.username ?? att.user_uid}</h3>
                          <p className="text-sm text-muted-foreground">프로필</p>
                        </div>
                        <div>
                          <p className="font-medium">{att.start_at ?? '미출근'}</p>
                          <p className="text-sm text-muted-foreground">출근</p>
                        </div>
                        <div>
                          <p className="font-medium">{att.end_at ?? '미퇴근'}</p>
                          <p className="text-sm text-muted-foreground">퇴근</p>
                        </div>
                        <div className="flex justify-end">
                          <Badge variant={
                            att.status === 'working' ? 'working' :
                            att.status === 'ended' ? 'ended' :
                            att.status === 'not_started' ? 'not-started' : 'default'
                          }>
                            {att.status === 'working' ? '근무 중' :
                             att.status === 'ended' ? '종료' :
                             att.status === 'not_started' ? '미시작' : att.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
