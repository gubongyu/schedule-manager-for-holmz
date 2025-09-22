import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api, type SubstitutionRequest } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const useWorkerSubstitutions = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SubstitutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | number | null>(null);

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
    createRequest,
    applyToRequest,
  };
};
