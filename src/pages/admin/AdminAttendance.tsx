import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { mockAttendance, getAttendanceByDate } from '@/lib/mock/attendance';

const AdminAttendance: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const filteredAttendance = selectedDate ? getAttendanceByDate(selectedDate) : mockAttendance;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'working': return '근무 중';
      case 'ended': return '종료';
      case 'not_started': return '미시작';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'working': return 'working' as const;
      case 'ended': return 'ended' as const;
      case 'not_started': return 'not-started' as const;
      default: return 'default' as const;
    }
  };

  const stats = {
    total: filteredAttendance.length,
    working: filteredAttendance.filter(att => att.status === 'working').length,
    ended: filteredAttendance.filter(att => att.status === 'ended').length,
    notStarted: filteredAttendance.filter(att => att.status === 'not_started').length
  };

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
        
        {filteredAttendance.length > 0 ? (
          <div className="space-y-4">
            {filteredAttendance.map((attendance) => (
              <Card key={attendance.id}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                    <div>
                      <h3 className="font-medium">{attendance.userName}</h3>
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
            ))}
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

// Helper function to calculate work hours
const calculateWorkHours = (startTime: string, endTime: string): string => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  const diffMinutes = endTotal - startTotal;
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  return `${hours}시간 ${minutes}분`;
};

export default AdminAttendance;