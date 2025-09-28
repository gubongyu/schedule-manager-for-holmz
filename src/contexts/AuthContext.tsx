import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'admin' | 'worker';

type AppUser = {
  auth_id: string;
  email: string | null;
  username: string;
  role: Role;
  department?: string | null;
};

type LoginResult = { success: true } | { success: false; error?: string };

type AuthContextType = {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (idOrEmail: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);

  const loadProfile = async (authId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('auth_id, username, role, department')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) throw error;
    const auth = (await supabase.auth.getUser()).data.user;
    if (!auth) return setUser(null);
    if (!data) return setUser(null);

    setUser({
      auth_id: data.auth_id,
      email: auth.email ?? null,
      username: data.username,
      role: data.role as Role,
      department: data.department ?? null,
    });
  };

  const login = async (idOrEmail: string, password: string): Promise<LoginResult> => {
    try {
      let email = idOrEmail;
      if (!idOrEmail.includes('@')) {
        const { data, error } = await supabase.rpc('get_email_for_username', { p_username: idOrEmail });
        if (error) throw error;
        if (!data) return { success: false, error: '해당 아이디의 이메일을 찾지 못했습니다.' };
        email = data as string;
      }

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) return { success: false, error: signInErr.message };

      const uid = signInData.user?.id;
      if (!uid) return { success: false, error: '인증 정보가 유효하지 않습니다.' };
      await loadProfile(uid);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message ?? '로그인 실패' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loadProfile(data.user.id);
  };

  useEffect(() => {
    // 초기 세션 + 구독
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await loadProfile(data.user.id);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) loadProfile(uid);
      else setUser(null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, isAuthenticated: !!user, login, logout, refreshProfile
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
