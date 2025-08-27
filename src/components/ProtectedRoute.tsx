import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'worker' | 'admin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }

    if (requiredRole && user?.role !== requiredRole) {
      toast({
        variant: "destructive",
        title: "접근 권한이 없습니다",
        description: "이 페이지에 접근할 권한이 없습니다."
      });
      navigate('/auth/login');
      return;
    }
  }, [isAuthenticated, user, requiredRole, navigate]);

  if (!isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;