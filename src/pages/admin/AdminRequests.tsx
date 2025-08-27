import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { mockSubstitutions, updateSubstitutionStatus } from '@/lib/mock/substitutions';

const AdminRequests: React.FC = () => {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleApproval = async (requestId: string, action: 'approved' | 'rejected') => {
    setIsLoading(requestId);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateSubstitutionStatus(requestId, action);
      
      toast({
        title: action === 'approved' ? "승인 완료" : "반려 완료",
        description: action === 'approved' ? "승인되었습니다." : "반려되었습니다."
      });
      
      // Force re-render
      window.location.reload();
    } finally {
      setIsLoading(null);
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

  const pendingRequests = mockSubstitutions.filter(req => req.status === 'pending');
  const processedRequests = mockSubstitutions.filter(req => req.status !== 'pending');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">대체 근무자 신청 확인</h1>
        <p className="text-muted-foreground mt-2">
          대체 근무 요청을 검토하고 승인 또는 반려할 수 있습니다.
        </p>
      </div>

      {/* Pending Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">승인 대기 중인 요청 ({pendingRequests.length}건)</h2>
        {pendingRequests.length > 0 ? (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                    <div>
                      <h3 className="font-medium">{request.ownerName}</h3>
                      <p className="text-sm text-muted-foreground">요청자</p>
                    </div>
                    
                    <div>
                      <p className="font-medium">{request.date}</p>
                      <p className="text-sm text-muted-foreground">{request.timeRange}</p>
                    </div>
                    
                    <div>
                      <Badge variant={getStatusVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                      {request.applicants.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          신청자: {request.applicants.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="success" 
                        size="sm"
                        onClick={() => handleApproval(request.id, 'approved')}
                        disabled={isLoading === request.id}
                      >
                        {isLoading === request.id ? '처리 중...' : '승인'}
                      </Button>
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={() => handleApproval(request.id, 'rejected')}
                        disabled={isLoading === request.id}
                      >
                        {isLoading === request.id ? '처리 중...' : '반려'}
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
              <p className="text-muted-foreground">승인 대기 중인 요청이 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Processed Requests */}
      <div>
        <h2 className="text-xl font-semibold mb-4">처리 완료된 요청 ({processedRequests.length}건)</h2>
        {processedRequests.length > 0 ? (
          <div className="space-y-4">
            {processedRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                    <div>
                      <h3 className="font-medium">{request.ownerName}</h3>
                      <p className="text-sm text-muted-foreground">요청자</p>
                    </div>
                    
                    <div>
                      <p className="font-medium">{request.date}</p>
                      <p className="text-sm text-muted-foreground">{request.timeRange}</p>
                    </div>
                    
                    <div>
                      <Badge variant={getStatusVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                      {request.applicants.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          신청자: {request.applicants.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString('ko-KR')} 처리
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">처리된 요청이 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-warning">{pendingRequests.length}</p>
            <p className="text-sm text-muted-foreground">승인 대기</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-success">
              {processedRequests.filter(r => r.status === 'approved').length}
            </p>
            <p className="text-sm text-muted-foreground">승인 완료</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold text-danger">
              {processedRequests.filter(r => r.status === 'rejected').length}
            </p>
            <p className="text-sm text-muted-foreground">반려</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRequests;