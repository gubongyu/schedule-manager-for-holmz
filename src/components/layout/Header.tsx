import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <h1 
              className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => navigate('/')}
            >
              HOLMZ
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-semibold">
                  {user.name.charAt(0)}
                </span>
              </div>
              <div className="text-sm">
                <div className="font-medium text-foreground">{user.name}</div>
                <div className="text-muted-foreground">
                  {user.role === 'admin' ? '관리자' : '근무자'}
                </div>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;