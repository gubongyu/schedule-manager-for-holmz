import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '@/types';
import { mockUsers } from '@/lib/mock/users';

interface AuthContextType extends AuthState {
  login: (id: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false
  });

  useEffect(() => {
    // Check for stored auth data on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAuthState({
          user,
          token: storedToken,
          isAuthenticated: true
        });
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (id: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Mock login validation
    if ((id === 'worker1' && password === '1234') || (id === 'admin' && password === 'admin')) {
      const user = mockUsers.find(u => u.id === id);
      if (user) {
        const token = `mock-token-${Date.now()}`;
        
        setAuthState({
          user,
          token,
          isAuthenticated: true
        });
        
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { success: true };
      }
    }
    
    return { success: false, error: '아이디 또는 비밀번호를 확인하세요.' };
  };

  const logout = () => {
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false
    });
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};