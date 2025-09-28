import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkerSubstitution } from '@/features/substitution/worker/useWorkerSubstitution';

type Status = 'pending' | 'approved' | 'rejected';

const getStatusText = (status: Status | string) => {
  switch (status) {
    case 'pending': return '승인 대기';
    case 'approved': return '승인 완료';
    case 'rejected': return '반려';
    default: return String(status);
  }
};

const getStatusVariant = (status: Status | string) => {
  switch (status) {
    case 'pending': return 'pending' as const;
    case 'approved': return 'approved' as const;
    case 'rejected': return 'rejected' as const;
    default: return 'default' as const;
  }
};

const WorkerSubstitute: React.FC = () => {
  const {
    user,
    userRequests,
    availableRequests,
    loading,
    err,
    creating,
    applyingId,
    applyToRequest,
    requestDate,
    setRequestDate,
    timeRange,
    setTimeRange,
    todayKey,
    handleCreateRequest,
  } = useWorkerSubstitution();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">대체 근무 요청</h1>
        <p className="text-muted-foreground mt-2">
          대체 근무를 요청하거나 다른 근무자의 요청에 신청할 수 있습니다.
        </p>
      </div>

      {/* Create Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>새 대체 근무 요청</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">요청 날짜</Label>
                <Input
                  id="date"
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  min={todayKey}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeRange">요청 시간대</Label>
                <Input
                  id="timeRange"
                  placeholder="예: 07:00 - 15:00"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={creating}>
              {creating ? '요청 중...' : '대체 근무 요청하기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">내 요청 현황</h2>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">불러오는 중...</CardContent></Card>
        ) : err ? (
          <Card><CardContent className="py-12 text-center text-destructive">{err}</CardContent></Card>
        ) : userRequests.length > 0 ? (
          <div className="space-y-4">
            {userRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{request.date}</h3>
                      <p className="text-sm text-muted-foreground">{request.timeRange}</p>
                      {request.applicants?.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          신청자: {request.applicants.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <Badge variant={getStatusVariant(request.status)}>
                      {getStatusText(request.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="text-center py-12">
            <p className="text-muted-foreground">등록된 요청이 없습니다.</p>
          </CardContent></Card>
        )}
      </div>

      {/* Available Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">신청 가능한 요청</h2>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">불러오는 중...</CardContent></Card>
        ) : err ? (
          <Card><CardContent className="py-12 text-center text-destructive">{err}</CardContent></Card>
        ) : availableRequests.length > 0 ? (
          <div className="space-y-4">
            {availableRequests.map((request) => {
              const alreadyApplied = request.applicants?.some(a => a.id === user?.id);
              return (
                <Card key={request.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{request.ownerName}님의 요청</h3>
                        <p className="text-sm text-muted-foreground">
                          {request.date} · {request.timeRange}
                        </p>
                        {request.applicants?.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            신청자 {request.applicants.length}명
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getStatusVariant(request.status)}>
                          {getStatusText(request.status)}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => applyToRequest(request.id)}
                          disabled={alreadyApplied || applyingId === request.id}
                        >
                          {applyingId === request.id ? '신청 중...' : alreadyApplied ? '신청 완료' : '신청하기'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="text-center py-12">
            <p className="text-muted-foreground">신청 가능한 요청이 없습니다.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default WorkerSubstitute;
