// src/lib/api/users.ts
import { supabase } from '@/lib/supabaseClient';

export const listWorkers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('auth_id, username, role, department')
    .eq('role', 'worker')
    .order('username', { ascending: true });
  if (error) throw error;

  return data ?? [];
};

// 클라이언트에서 프로필만 생성 (auth.users FK가 있다면 실패할 수 있음)
export const createWorker = async (payload: { name: string; department: string }) => {
  // name은 display용, username도 같이 채워둠
  const insert = {
    username: payload.name,
    department: payload.department,
    role: 'worker',
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(insert)
    .select('auth_id, username, role, department')
    .single();

  if (error) throw error;
  return data;
};

export const deleteWorker = async (id: string) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('auth_id', id);
  if (error) throw error;
};
