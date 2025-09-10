// src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BarChart3, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import WorkScheduleCalendar from '@/components/shared/WorkScheduleCalendar';

// APIs
import * as attendanceApi from '@/lib/api/attendance';
import * as shiftApi from '@/lib/api/shifts';
import * as subsApi from '@/lib/api/substitutions';

type BusyKey = 'start' | 'end' | null;

type Shift = {
  date: string;     // 'YYYY-MM-DD'
  start: string;    // 'HH:MM'
  end: string;      // 'HH:MM'
  workerId?: string;
  workerName?: string;
};

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<BusyKey>(null);

  // ===== Worker data =====
  const today = useMemo(() => getLocalDateKey(new Date()), []);
  const [att, setAtt] = useState<attendanceApi.Attendance | null>(null);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [wLoading, setWLoading] = useState<boolean>(true);
  const [wErr, setWErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.id || user.role !== 'worker') return;
      setWLoading(true);
      setWErr(null);
      try {
        const [attendance, shifts] = await Promise.all([
          attendanceApi.getAttendanceByUserDate(user.id, today),
          // 필요: getShiftsByWorker(userId)
          shiftApi.getShiftsByWorker(user.id),
        ]);
        setAtt(attendance ?? null);
        setMyShifts(shifts ?? []);
      } catch (e: any) {
        setWErr(e?.message ?? '데이터를 불러오지 못했습니다.');
      } finally {
        setWLoading(false);
      }
    })();
  }, [user?.id, user?.role, today]);

  const handleStartWork = async () => {
    if (!user?.id) return;
    if (att?.status === 'working' || att?.status === 'ended') {
      toast({
        variant: 'destructive',
        title: '이미 처리된 상태입니다',
        description: att.status === 'working' ? '이미 근무를 시작했습니다.' : '이미 근무를 종료했습니다.',
      });
      return;
    }
    setBusy('start');
    try {
      const updated = await attendanceApi.startWork(user.id);
      setAtt(updated);
      toast({ title: '근무 시작', description: '근무를 시작했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '시작 실패', description: e?.message ?? '오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  const handleEndWork = async () => {
    if (!user?.id) return;
    if (att?.status === 'ended') {
      toast({ variant: 'destructive', title: '이미 처리된 상태입니다', description: '이미 근무를 종료했습니다.' });
      return;
    }
    if (att?.status !== 'working') {
      toast({ variant: 'destructive', title: '근무를 시작해주세요', description: '근무 시작 후 종료할 수 있습니다.' });
      return;
    }
    setBusy('end');
    try {
      const updated = await attendanceApi.endWork(user.id);
      setAtt(updated);
      toast({ title: '근무 종료', description: '근무를 종료했습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '종료 실패', description: e?.message ?? '오류가 발생했습니다.' });
    } finally {
      setBusy(null);
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
            {wLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : wErr ? (
              <div className="text-sm text-destructive">{wErr}</div>
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
                    {att?.startAt && <span className="text-sm text-muted-foreground">출근: {att.startAt}</span>}
                    {att?.endAt && <span className="text-sm text-muted-foreground">퇴근: {att.endAt}</span>}
                  </div>
                </div>
              </div>
            )}
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
            disabled={att?.status === 'working' || att?.status === 'ended' || busy === 'start' || wLoading}
            className="h-16"
          >
            {busy === 'start' ? '처리 중...' : '근무 시작'}
          </Button>
          <Button
            variant="danger"
            onClick={handleEndWork}
            disabled={att?.status !== 'working' || busy === 'end' || wLoading}
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
        </div>
      </div>
    );
  }

  // ===== Admin data =====
  const [aLoading, setALoading] = useState<boolean>(true);
  const [aErr, setAErr] = useState<string | null>(null);
  const [todayWorkingCount, setTodayWorkingCount] = useState<number>(0);
  const [pendingSubs, setPendingSubs] = useState<number>(0);
  const [weekShiftDays, setWeekShiftDays] = useState<number>(0);

  useEffect(() => {
    (async () => {
      setALoading(true);
      setAErr(null);
      try {
        // 오늘 근무 중 인원
        const todays = await attendanceApi.getAttendanceByDate(today);
        setTodayWorkingCount((todays ?? []).filter(r => r.status === 'working').length);

        // 승인 대기 대체요청
        try {
          const pending = await subsApi.countSubstitutionsByStatus('pending');
          setPendingSubs(pending);
        } catch {
          // count API가 없다면 목록으로 대체
          const rows = await subsApi.listSubstitutions();
          setPendingSubs(rows.filter(r => r.status === 'pending').length);
        }

        // 이번 주 총 근무일(배정된 날짜 수)
        const start = new Date();
        const dow = start.getDay(); // 0=Sun
        start.setDate(start.getDate() - dow); // Sunday
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Saturday

        const startKey = getLocalDateKey(start);
        const endKey = getLocalDateKey(end);

        // 월별 API만 있다면 주가 걸친 두 달을 합쳐서 필터
        const monthKeys = Array.from(new Set([startKey.slice(0, 7), endKey.slice(0, 7)]));
        const monthShiftsArrays = await Promise.all(monthKeys.map(k => shiftApi.getShiftsByMonth(k)));
        const all = monthShiftsArrays.flat() as Shift[];

        const inWeek = all.filter(s => s.date >= startKey && s.date <= endKey);
        // "근무일 수"로 날짜 distinct
        const daySet = new Set(inWeek.map(s => s.date));
        setWeekShiftDays(daySet.size);
      } catch (e: any) {
        setAErr(e?.message ?? '통계를 불러오지 못했습니다.');
      } finally {
        setALoading(false);
      }
    })();
  }, [today]);

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
            {aLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : aErr ? (
              <div className="text-sm text-destructive">{aErr}</div>
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
            {aLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : aErr ? (
              <div className="text-sm text-destructive">{aErr}</div>
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
            {aLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : aErr ? (
              <div className="text-sm text-destructive">{aErr}</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{weekShiftDays}일</div>
                <p className="text-xs text-muted-foreground">이번 주 총 근무일</p>
              </>
            )}
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
        <Button onClick={() => navigate('/admin/reports/monthly-hours')} className="h-16">
          보고서
        </Button>
      </div>
    </div>
  );
};

export default Home;
