import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { api, type SubstitutionRequest } from '@/lib/api';

type Status = 'pending' | 'approved' | 'rejected';

export const useAdminSubstitution = () => {
  const [requests, setRequests] = useState<SubstitutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isLoadingId, setIsLoadingId] = useState<string | number | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.substitutions.listSubstitutions();
      setRequests(data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? '요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateRequestStatus = async (requestId: string | number, status: Status) => {
    setIsLoadingId(requestId);
    try {
      await api.substitutions.updateSubstitutionStatus(String(requestId), status);
      setRequests(prev =>
        prev.map(r => (r.id === requestId ? { ...r, status } : r))
      );
      toast({
        title: status === 'approved' ? '승인 완료' : '반려 완료',
        description: status === 'approved' ? '승인되었습니다.' : '반려되었습니다.',
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '처리 실패',
        description: e?.message ?? '요청 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoadingId(null);
    }
  };

  const pendingRequests = useMemo(
    () => requests.filter(req => req.status === 'pending'),
    [requests]
  );

  const processedRequests = useMemo(
    () => requests.filter(req => req.status !== 'pending'),
    [requests]
  );

  return {
    requests,
    loading,
    err,
    isLoadingId,
    updateRequestStatus,
    pendingRequests,
    processedRequests,
  };
};
