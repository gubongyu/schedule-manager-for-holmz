import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAdminAttendance } from '@/features/attendance/admin/useAdminAttendance';

type Status = 'working' | 'ended' | 'not_started';

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

const AdminAttendance: React.FC = () => {
  const {
    selectedDate,
    setSelectedDate,
    attendance,
    profileMap,
    loading,
    err,
    stats,
  } = useAdminAttendance();

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
        ) : attendance.length > 0 ? (
          <div className="space-y-4">
            {attendance.map((att) => {
              const w = profileMap.get(att.user_uid);
              const displayName = w?.username ?? att.user_uid;
              return (
                <Card key={att.id ?? `${att.user_uid}-${att.date}`}>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                      <div>
                        <h3 className="font-medium">{displayName}</h3>
                        <p className="text-sm text-muted-foreground">프로필</p>
                      </div>

                      <div>
                        <p className="font-medium">
                          {att.start_at ? `출근: ${att.start_at}` : '미출근'}
                        </p>
                        <p className="text-sm text-muted-foreground">출근 시간</p>
                      </div>

                      <div>
                        <p className="font-medium">
                          {att.end_at ? `퇴근: ${att.end_at}` : '미퇴근'}
                        </p>
                        <p className="text-sm text-muted-foreground">퇴근 시간</p>
                      </div>

                      <div className="flex justify-end">
                        <Badge variant={getStatusVariant(att.status)}>
                          {getStatusText(att.status)}
                        </Badge>
                      </div>
                    </div>

                    {att.start_at && att.end_at && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          총 근무 시간: {calculateWorkHours(att.start_at, att.end_at)}
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

export default AdminAttendance;
