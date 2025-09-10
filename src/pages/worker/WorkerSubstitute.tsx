import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import * as subsApi from '@/lib/api/substitutions';

type Status = 'pending' | 'approved' | 'rejected';

const getLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseTimeRange = (text: string): { start: string; end: string } | null => {
  // 지원 포맷 예: "07:00 - 15:00" (양쪽 공백 허용)
  const m = text.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let [ , sh, sm, eh, em ] = m;
  const Hs = Number(sh), Ms = Number(sm), He = Number(eh), Me = Number(em);
  const validHH = (h: number) => h >= 0 && h <= 24;
  const validMM = (m: number) => m >= 0 && m <= 59;
  if (!validHH(Hs) || !validHH(He) || !validMM(Ms) || !validMM(Me)) return null;
  // 24:00은 종료 시간에만 허용
  if (Hs === 24 || (He === 24 && Me !== 0)) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${pad(Hs)}:${pad(Ms)}`;
  const end   = `${pad(He)}:${pad(Me)}`;
  return { start, end };
};

const WorkerSubstitute: React.FC = () => {
  const { user } = useAuth();
  const [requestDate, setRequestDate] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [creating, setCreating] = useState(false);

  const [rows, setRows] = useState<subsApi.SubstitutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | number | null>(null);

  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await subsApi.listSubstitutions();
      setRows(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '대체 근무 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const userRequests = useMemo(
    () => (user?.id ? rows.filter(r => r.ownerId === user.id) : []),
    [rows, user?.id]
  );

  const availableRequests = useMemo(() => {
    if (!user?.id) return [];
    return rows.filter(r =>
      r.ownerId !== user.id &&
      r.status === 'pending' &&
      !(r.applicants ?? []).some(a => a.id === user.id)
    );
  }, [rows, user?.id]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !requestDate || !timeRange) return;

    const parsed = parseTimeRange(timeRange.trim());
    if (!parsed) {
      toast({
        variant: 'destructive',
        title: '시간대 형식이 올바르지 않습니다',
        description: '예: 07:00 - 15:00 형식으로 입력하세요.',
      });
      return;
    }

    setCreating(true);
    try {
      const created = await subsApi.createSubstitution({
        date: requestDate,
        start: parsed.start,
        end: parsed.end,
        ownerId: user.id,
      });

      // 생성 시 ownerName은 API가 제공하지만, 없으면 로컬로 보정
      const withOwner = {
        ...created,
        ownerName: created.ownerName ?? user.name ?? user.id,
      } as subsApi.SubstitutionRequest;

      setRows(prev => [withOwner, ...prev]);

      toast({ title: '요청 완료', description: '대체 근무 요청이 등록되었습니다.' });
      setRequestDate('');
      setTimeRange('');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '요청 실패',
        description: e?.message ?? '요청 등록 중 오류가 발생했습니다.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleApplyToRequest = async (requestId: string | number) => {
    if (!user?.id) return;

    setApplyingId(requestId);
    try {
      const applicant = await subsApi.applyToSubstitution(String(requestId), user.id);
      // 로컬 반영
      setRows(prev =>
        prev.map(r =>
          r.id === requestId
            ? { ...r, applicants: [...(r.applicants ?? []), applicant] }
            : r
        )
      );
      toast({ title: '신청 완료', description: '신청이 완료되었습니다.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '신청 실패',
        description: error?.message ?? '신청 중 오류가 발생했습니다.',
      });
    } finally {
      setApplyingId(null);
    }
  };

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
                          onClick={() => handleApplyToRequest(request.id)}
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
