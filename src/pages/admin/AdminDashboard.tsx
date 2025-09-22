// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type Attendance } from '@/lib/api';

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const todayKey = getLocalDateKey(new Date());

  const [totalWorkers, setTotalWorkers] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [pendingSubs, setPendingSubs] = useState<number>(0);

  // 선택: 오늘 시프트(배정/미배정) 간단 통계가 필요하면 사용
  const [todayAssignedCount, setTodayAssignedCount] = useState<number>(0);
  const [todayUnassignedCount, setTodayUnassignedCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 근무자 수
        const nWorkers = (await api.users.listWorkers()).length;
        setTotalWorkers(nWorkers);

        // 오늘 출퇴근
        const att = await api.attendance.getAttendanceByDate(todayKey);
        setTodayAttendance(att ?? []);

        // 대체요청 대기 건수
        const pending = await api.substitutions.countSubstitutionsByStatus('pending');
        setPendingSubs(pending);

        // 오늘 시프트 배정/미배정 (optional)
        const monthKey = todayKey.slice(0, 7);
        const shifts = await api.shifts.getShiftsByMonth(monthKey);
        const todays = shifts.filter(s => s.date === todayKey);
        setTodayAssignedCount(todays.filter(s => !!s.workerId).length);
        setTodayUnassignedCount(todays.filter(s => !s.workerId).length);
      } catch (e: any) {
        setErr(e?.message ?? '대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [todayKey]);

  const stats = useMemo(() => {
    const working = todayAttendance.filter(a => a.status === 'working').length;
    const ended = todayAttendance.filter(a => a.status === 'ended').length;
    return { working, ended };
  }, [todayAttendance]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          오늘({new Date(todayKey).toLocaleDateString('ko-KR')})의 현황 요약입니다.
        </p>
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
        <Button variant="outline" onClick={() => navigate('/admin/reports/monthly-hours')} className="h-16">
          보고서
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
                <p className="text-2xl font-bold text-primary">{totalWorkers}</p>
                <p className="text-sm text-muted-foreground">총 근무자</p>
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
                  <Card key={att.id ?? `${att.userId}-${att.date}`}>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                        <div className="col-span-2">
                          <h3 className="font-medium">{att.userName ?? att.userId}</h3>
                          <p className="text-sm text-muted-foreground">근무자</p>
                        </div>
                        <div>
                          <p className="font-medium">{att.startAt ?? '미출근'}</p>
                          <p className="text-sm text-muted-foreground">출근</p>
                        </div>
                        <div>
                          <p className="font-medium">{att.endAt ?? '미퇴근'}</p>
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
