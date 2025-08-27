import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }

    // Redirect based on user role
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else if (user?.role === 'worker') {
      navigate('/worker/dashboard');
    }
  }, [user, isAuthenticated, navigate]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">리디렉션 중...</p>
      </div>
    </div>
  );
};

export default Home;