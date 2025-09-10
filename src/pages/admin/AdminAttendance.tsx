// src/pages/admin/AdminAttendance.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as attendanceApi from '@/lib/api/attendance';
import { listWorkers } from '@/lib/api/users';

type Status = 'working' | 'ended' | 'not_started';

type Worker = {
  id: string;
  name: string;
  department?: string;
};

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AdminAttendance: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey(new Date()));
  const [rows, setRows] = useState<attendanceApi.Attendance[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 근무자 목록 로드 (id -> name 매핑용)
  useEffect(() => {
    (async () => {
      try {
        const ws = await listWorkers();
        const normalized = ws.map((w: any) => ({
          id: w.id,
          name: w.name ?? w.username ?? '이름없음',
          department: w.department,
        })) as Worker[];
        setWorkers(normalized);
      } catch (e: any) {
        // 이름 매핑 실패해도 기능은 동작하므로 콘솔만 남김
        console.error(e);
      }
    })();
  }, []);

  // 날짜 바뀔 때마다 출퇴근 데이터 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await attendanceApi.getAttendanceByDate(selectedDate);
        setRows(data ?? []);
      } catch (e: any) {
        setErr(e?.message ?? '출퇴근 데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDate]);

  const workerMap = useMemo(() => {
    const m = new Map<string, Worker>();
    workers.forEach(w => m.set(w.id, w));
    return m;
  }, [workers]);

  const getStatusText = (status: Status | string) => {
    switch (status) {
      case 'working': return '근무 중';
      case 'ended': return '종료';
      case 'not_started': return '미시작';
      default: return String(status);
    }
  };

  const getStatusVariant = (status: Status | string) => {
    switch (status) {
      case 'working': return 'working' as const;
      case 'ended': return 'ended' as const;
      case 'not_started': return 'not-started' as const;
      default: return 'default' as const;
    }
  };

  const stats = useMemo(() => ({
    total: rows.length,
    working: rows.filter(att => att.status === 'working').length,
    ended: rows.filter(att => att.status === 'ended').length,
    notStarted: rows.filter(att => att.status === 'not_started').length,
  }), [rows]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">출퇴근 기록</h1>
        <p className="text-muted-foreground mt-2">
          근무자별 출퇴근 현황을 확인할 수 있습니다.
        </p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">날짜 선택</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-sm text-muted-foreground">총 기록</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-success">{stats.working}</p>
            <p className="text-sm text-muted-foreground">근무 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.ended}</p>
            <p className="text-sm text-muted-foreground">종료</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-warning">{stats.notStarted}</p>
            <p className="text-sm text-muted-foreground">미시작</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          출퇴근 기록 ({selectedDate ? new Date(selectedDate).toLocaleDateString('ko-KR') : '전체'})
        </h2>

        {loading ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">불러오는 중...</p>
            </CardContent>
          </Card>
        ) : err ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-destructive">{err}</p>
            </CardContent>
          </Card>
        ) : rows.length > 0 ? (
          <div className="space-y-4">
            {rows.map((attendance) => {
              const w = workerMap.get(attendance.userId);
              const displayName = attendance.userName ?? w?.name ?? attendance.userId;
              return (
                <Card key={attendance.id ?? `${attendance.userId}-${attendance.date}`}>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                      <div>
                        <h3 className="font-medium">{displayName}</h3>
                        <p className="text-sm text-muted-foreground">근무자</p>
                      </div>

                      <div>
                        <p className="font-medium">
                          {attendance.startAt ? `출근: ${attendance.startAt}` : '미출근'}
                        </p>
                        <p className="text-sm text-muted-foreground">출근 시간</p>
                      </div>

                      <div>
                        <p className="font-medium">
                          {attendance.endAt ? `퇴근: ${attendance.endAt}` : '미퇴근'}
                        </p>
                        <p className="text-sm text-muted-foreground">퇴근 시간</p>
                      </div>

                      <div className="flex justify-end">
                        <Badge variant={getStatusVariant(attendance.status)}>
                          {getStatusText(attendance.status)}
                        </Badge>
                      </div>
                    </div>

                    {attendance.startAt && attendance.endAt && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          총 근무 시간: {calculateWorkHours(attendance.startAt, attendance.endAt)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">기록이 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Helper: 근무 시간 계산 (자정 넘김 보정)
const calculateWorkHours = (startTime: string, endTime: string): string => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);

  const s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e < s) e += 24 * 60; // 자정을 넘어갔을 때 보정

  const diff = e - s;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}시간 ${m}분`;
};

export default AdminAttendance;
