import { supabase } from '@/lib/supabaseClient';
import type { Shift } from '@/domain';

// 'HH:MM:SS' → 'HH:MM'로 정리 + 23:59:59 → 24:00(표시용) 처리
const fmtHHMM = (t?: string | null) => {
  if (!t) return '';
  // 풀데이 표현을 위해 '23:59:59' 저장 시 표시에선 '24:00'로
  if (t.startsWith('23:59')) return '24:00';
  return t.slice(0, 5);
};

// monthKey('YYYY-MM') → [startKey, endKey)
const monthRange = (monthKey: string): { startKey: string; endKey: string } => {
  const [y, m] = monthKey.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startKey: `${y}-${pad(m)}-01`,
    endKey: `${nextY}-${pad(nextM)}-01`,
  };
};

// 월별 조회 (범위 조건)
// export const getShiftsByMonth = async (monthKey: string): Promise<Shift[]> => {
//   const { startKey, endKey } = monthRange(monthKey);
//   const { data, error } = await supabase
//     .from('shifts')
//     .select('id, date, start, end, worker_id, is_weekend')
//     .gte('date', startKey)
//     .lt('date', endKey)
//     .order('date', { ascending: true });
  
//   console.log(data);
//   if (error) throw error;
//   return (data ?? []).map((r: any) => ({
//     id: r.id,
//     date: r.date,
//     start: fmtHHMM(r.start),
//     end: fmtHHMM(r.end),
//     workerId: r.worker_id,
//     isWeekend: r.is_weekend,
//   }));
// };

// lib/api/shifts.ts (현재 함수 바디만 교체)
export const getShiftsByMonth = async (monthKey: string): Promise<Shift[]> => {
  const { startKey, endKey } = monthRange(monthKey);

  // ✅ profiles 조인으로 이름 가져오기
  const { data, error } = await supabase
    .from('shifts')
    .select(`
      id,
      date,
      start,
      end,
      worker_id,
      is_weekend,
      profiles:worker_id (
        name,
        username
      )
    `)
    .gte('date', startKey)
    .lt('date', endKey)
    .order('date', { ascending: true })
    .order('start', { ascending: true });

  if (error) throw error;

  console.log(data);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    start: fmtHHMM(r.start),      // 'HH:MM'로 보정
    end: fmtHHMM(r.end),
    workerId: r.worker_id ?? undefined,
    workerName: r.profiles?.name ?? r.profiles?.username ?? undefined, // ✅ 이름 매핑
    isWeekend: r.is_weekend,
  }));
};


// 특정 사용자 전체(또는 필요시 주/월 단위로 별도 범위 추가)
export const getShiftsByWorker = async (userId: string): Promise<Shift[]> => {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, date, start, end, worker_id, is_weekend')
    .eq('worker_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    start: fmtHHMM(r.start),
    end: fmtHHMM(r.end),
    workerId: r.worker_id,
    isWeekend: r.is_weekend,
  }));
};

// 범용: 날짜 범위 조회
export const getShiftsByRange = async (
  startKey: string, // 'YYYY-MM-DD'
  endKey: string    // 'YYYY-MM-DD' (exclusive)
): Promise<Shift[]> => {
  const { data, error } = await supabase
    .from('shifts')
    .select('id, date, start, end, worker_id, is_weekend')
    .gte('date', startKey)
    .lt('date', endKey)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    start: fmtHHMM(r.start),
    end: fmtHHMM(r.end),
    workerId: r.worker_id,
    isWeekend: r.is_weekend,
  }));
};
