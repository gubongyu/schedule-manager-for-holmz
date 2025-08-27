import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { mockUsers } from '@/lib/mock/users';

const AdminWorkers: React.FC = () => {
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const workers = mockUsers.filter(user => user.role === 'worker');

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName || !newWorkerDept) return;

    setIsLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would call an API
      const newWorker = {
        id: `worker${Date.now()}`,
        name: newWorkerName,
        role: 'worker' as const,
        department: newWorkerDept
      };
      
      mockUsers.push(newWorker);

      toast({
        title: "근무자 추가 완료",
        description: "근무자가 추가되었습니다."
      });

      setNewWorkerName('');
      setNewWorkerDept('');
      
      // Force re-render
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: string, workerName: string) => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const index = mockUsers.findIndex(user => user.id === workerId);
      if (index > -1) {
        mockUsers.splice(index, 1);
        
        toast({
          title: "근무자 삭제 완료",
          description: `${workerName}님이 삭제되었습니다.`
        });
        
        // Force re-render
        window.location.reload();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: "근무자 삭제 중 오류가 발생했습니다."
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">근무자 명단 관리</h1>
        <p className="text-muted-foreground mt-2">
          근무자를 추가하거나 삭제할 수 있습니다.
        </p>
      </div>

      {/* Add Worker Form */}
      <Card>
        <CardHeader>
          <CardTitle>새 근무자 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddWorker} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder="근무자 이름을 입력하세요"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">소속</Label>
                <Input
                  id="department"
                  value={newWorkerDept}
                  onChange={(e) => setNewWorkerDept(e.target.value)}
                  placeholder="소속 부서를 입력하세요"
                  required
                />
              </div>
            </div>
            
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '추가 중...' : '추가'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Workers List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">현재 근무자 명단</h2>
        {workers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((worker) => (
              <Card key={worker.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-semibold">
                          {worker.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium">{worker.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {worker.department}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Badge variant="approved">활성</Badge>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => handleDeleteWorker(worker.id, worker.name)}
                    >
                      삭제
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">등록된 근무자가 없습니다.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">총 근무자 수</h3>
              <p className="text-sm text-muted-foreground">현재 등록된 근무자</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{workers.length}</p>
              <p className="text-sm text-muted-foreground">명</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWorkers;