import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkers, type Worker } from '@/hooks/useWorkers';

const AdminWorkers: React.FC = () => {
  const {
    workers,
    loading,
    err,
    deletingId,
    isAdding,
    addWorker,
    deleteWorker,
  } = useWorkers();

  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('');

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addWorker({ name: newWorkerName, department: newWorkerDept });
      setNewWorkerName('');
      setNewWorkerDept('');
    } catch (e) {
      // Error is already handled by the toast in the hook
      console.error(e);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">근무자 명단 관리</h1>
        <p className="text-muted-foreground mt-2">근무자를 추가하거나 삭제할 수 있습니다.</p>
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

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isAdding}>
                {isAdding ? '추가 중...' : '추가'}
              </Button>
              <p className="text-xs text-muted-foreground">
                (참고) 인증계정 생성/초대가 필요한 경우 서버 함수로 처리해야 합니다.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Workers List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">현재 근무자 명단</h2>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">불러오는 중...</CardContent>
          </Card>
        ) : err ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">{err}</CardContent>
          </Card>
        ) : workers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((worker) => (
              <Card key={worker.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground font-semibold">
                          {worker.name?.charAt(0) ?? '·'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium">{worker.name}</h3>
                        <p className="text-sm text-muted-foreground">{worker.department}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <Badge variant="approved">활성</Badge>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteWorker(worker.id, worker.name)}
                      disabled={deletingId === worker.id}
                    >
                      {deletingId === worker.id ? '삭제 중...' : '삭제'}
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
      {!loading && !err && (
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
      )}
    </div>
  );
};

export default AdminWorkers;
