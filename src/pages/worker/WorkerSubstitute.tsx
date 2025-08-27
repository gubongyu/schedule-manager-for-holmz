import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { mockSubstitutions, addSubstitution, applyToSubstitution, getSubstitutionsByUser } from '@/lib/mock/substitutions';
import { mockUsers } from '@/lib/mock/users';

const WorkerSubstitute: React.FC = () => {
  const { user } = useAuth();
  const [requestDate, setRequestDate] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const userRequests = user ? getSubstitutionsByUser(user.id) : [];
  const availableRequests = mockSubstitutions.filter(req => 
    req.ownerId !== user?.id && 
    req.status === 'pending' && 
    !req.applicantIds.includes(user?.id || '')
  );

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !requestDate || !timeRange) return;

    setIsLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addSubstitution({
        date: requestDate,
        timeRange,
        ownerId: user.id,
        ownerName: user.name,
        applicantIds: [],
        applicants: [],
        status: 'pending'
      });

      toast({
        title: "요청 완료",
        description: "대체 근무 요청이 등록되었습니다."
      });

      setRequestDate('');
      setTimeRange('');
      
      // Force re-render
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToRequest = async (requestId: string) => {
    if (!user) return;

    try {
      applyToSubstitution(requestId, user.id);
      toast({
        title: "신청 완료",
        description: "신청이 완료되었습니다."
      });
      
      // Force re-render
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "신청 실패",
        description: "신청 중 오류가 발생했습니다."
      });
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기';
      case 'approved': return '승인 완료';
      case 'rejected': return '반려';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'pending' as const;
      case 'approved': return 'approved' as const;
      case 'rejected': return 'rejected' as const;
      default: return 'default' as const;
    }
  };

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
                  min={new Date().toISOString().split('T')[0]}
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
            
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '요청 중...' : '대체 근무 요청하기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">내 요청 현황</h2>
        {userRequests.length > 0 ? (
          <div className="space-y-4">
            {userRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{request.date}</h3>
                      <p className="text-sm text-muted-foreground">{request.timeRange}</p>
                      {request.applicants.length > 0 && (
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
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">등록된 요청이 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">신청 가능한 요청</h2>
        {availableRequests.length > 0 ? (
          <div className="space-y-4">
            {availableRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{request.ownerName}님의 요청</h3>
                      <p className="text-sm text-muted-foreground">
                        {request.date} · {request.timeRange}
                      </p>
                      {request.applicants.length > 0 && (
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
                        onClick={() => handleApplyToRequest(request.id)}
                      >
                        신청하기
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">신청 가능한 요청이 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkerSubstitute;