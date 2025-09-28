import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api, type SubstitutionRequest } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const getLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parseTimeRange = (text: string): { start: string; end: string } | null => {
    const m = text.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    let [ , sh, sm, eh, em ] = m;
    const Hs = Number(sh), Ms = Number(sm), He = Number(eh), Me = Number(em);
    const validHH = (h: number) => h >= 0 && h <= 24;
    const validMM = (m: number) => m >= 0 && m <= 59;
    if (!validHH(Hs) || !validHH(He) || !validMM(Ms) || !validMM(Me)) return null;
    if (Hs === 24 || (He === 24 && Me !== 0)) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${pad(Hs)}:${pad(Ms)}`;
    const end   = `${pad(He)}:${pad(Me)}`;
    return { start, end };
};

export const useWorkerSubstitution = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SubstitutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | number | null>(null);

  const [requestDate, setRequestDate] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.substitutions.listSubstitutions();
      setRequests(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '대체 근무 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const userRequests = useMemo(
    () => (user?.id ? requests.filter(r => r.ownerId === user.id) : []),
    [requests, user?.id]
  );

  const availableRequests = useMemo(() => {
    if (!user?.id) return [];
    return requests.filter(r =>
      r.ownerId !== user.id &&
      r.status === 'pending' &&
      !(r.applicants ?? []).some(a => a.id === user.id)
    );
  }, [requests, user?.id]);

  const createRequest = async (payload: { date: string; start: string; end: string; }) => {
    if (!user?.id) throw new Error("User not found");
    setCreating(true);
    try {
      const created = await api.substitutions.createSubstitution({
        ...payload,
        ownerId: user.id,
      });
      const withOwner = {
        ...created,
        ownerName: created.ownerName ?? user.name ?? user.id,
      } as SubstitutionRequest;
      setRequests(prev => [withOwner, ...prev]);
      toast({ title: '요청 완료', description: '대체 근무 요청이 등록되었습니다.' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '요청 실패',
        description: e?.message ?? '요청 등록 중 오류가 발생했습니다.',
      });
      throw e;
    } finally {
      setCreating(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseTimeRange(timeRange.trim());
    if (!parsed) {
      toast({
        variant: 'destructive',
        title: '시간대 형식이 올바르지 않습니다',
        description: '예: 07:00 - 15:00 형식으로 입력하세요.',
      });
      return;
    }

    try {
      await createRequest({ date: requestDate, ...parsed });
      setRequestDate('');
      setTimeRange('');
    } catch (e) {
      // Error is handled by the hook
      console.error(e);
    }
  };

  const applyToRequest = async (requestId: string | number) => {
    if (!user?.id) return;
    setApplyingId(requestId);
    try {
      const applicant = await api.substitutions.applyToSubstitution(String(requestId), user.id);
      setRequests(prev =>
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

  return {
    user,
    userRequests,
    availableRequests,
    loading,
    err,
    creating,
    applyingId,
    applyToRequest,
    // Form state and handlers
    requestDate,
    setRequestDate,
    timeRange,
    setTimeRange,
    todayKey,
    handleCreateRequest,
  };
};
