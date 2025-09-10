import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import * as attendanceApi from '@/lib/api/attendance';

type BusyKey = 'start' | 'end' | null;

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const WorkerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<BusyKey>(null);
  const [att, setAtt] = useState<attendanceApi.Attendance | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => getLocalDateKey(new Date()), []);

  // 오늘 내 출퇴근 상태 로드
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      setErr(null);
      try {
        const row = await attendanceApi.getAttendanceByUserDate(user.id, today);
        setAtt(row ?? null);
      } catch (e: any) {
        setErr(e?.message ?? '출퇴근 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, today]);

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
      toast({
        variant: 'destructive',
        title: '이미 처리된 상태입니다',
        description: '이미 근무를 종료했습니다.',
      });
      return;
    }
    if (att?.status !== 'working') {
      toast({
        variant: 'destructive',
        title: '근무를 시작해주세요',
        description: '근무 시작 후 종료할 수 있습니다.',
      });
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
      action: handleStartWork,
      variant: 'success' as const,
      disabled: att?.status === 'working' || att?.status === 'ended',
      loading: busy === 'start',
    },
    {
      title: '근무 종료',
      description: '오늘 근무를 종료하세요',
      action: handleEndWork,
      variant: 'danger' as const,
      disabled: att?.status !== 'working',
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
                      att?.status === 'working' ? 'working' :
                      att?.status === 'ended' ? 'ended' : 'not-started'
                    }
                  >
                    {att?.status === 'working' ? '근무 중' :
                     att?.status === 'ended' ? '근무 완료' : '미출근'}
                  </Badge>
                  {att?.startAt && (
                    <span className="text-sm text-muted-foreground">출근: {att.startAt}</span>
                  )}
                  {att?.endAt && (
                    <span className="text-sm text-muted-foreground">퇴근: {att.endAt}</span>
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
