import { supabase } from '@/lib/supabaseClient';
import type { WorkLog } from '@/domain';

export const createWorkLog = async (payload: Omit<WorkLog, 'id'>) => {
  const { data, error } = await supabase
    .from('work_logs')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as WorkLog;
};

export const listWorkLogsByProfile = async (profileId: string) => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('profile_id', profileId)
    .order('date', { ascending: false })
    .order('time', { ascending: false });
  if (error) throw error;
  return data as WorkLog[];
};

export const listAllWorkLogs = async () => {
  const { data, error } = await supabase
    .from('work_logs')
    .select('*, profiles(username)')
    .order('date', { ascending: false })
    .order('time', { ascending: false });
  if (error) throw error;
  return data as (WorkLog & { profiles: { username: string } })[];
};
