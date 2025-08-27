import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const Login: React.FC = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/worker/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !password) return;

    setIsLoading(true);
    const result = await login(id, password);
    
    if (result.success) {
      toast({
        title: "로그인 성공",
        description: "환영합니다!"
      });
    } else {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: result.error || "아이디 또는 비밀번호를 확인하세요."
      });
    }
    setIsLoading(false);
  };

  const handleQuickLogin = (userType: 'worker' | 'admin') => {
    if (userType === 'worker') {
      setId('worker1');
      setPassword('1234');
    } else {
      setId('admin');
      setPassword('admin');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">로그인</CardTitle>
          <CardDescription>근무 시간 관리 시스템에 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">아이디</Label>
              <Input
                id="id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="아이디를 입력하세요"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-4">
              빠른 로그인
            </p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleQuickLogin('worker')}
              >
                근무자 로그인 (worker1 / 1234)
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleQuickLogin('admin')}
              >
                관리자 로그인 (admin / admin)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;