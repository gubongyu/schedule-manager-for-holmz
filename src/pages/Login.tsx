// HOLMZ Schedule Management - 로그인 페이지 (id/password + 빠른 로그인 유지)

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Building2, User, KeyRound, ChevronRight } from "lucide-react";

const Login: React.FC = () => {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/worker/dashboard");
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "아이디/비밀번호를 입력해주세요",
        description: "로그인하려면 두 항목 모두 필요합니다.",
      });
      return;
    }

    setIsLoading(true);
    const result = await login(id, password);

    if (result.success) {
      toast({
        title: "로그인 성공",
        description: "환영합니다!",
      });
      // 리다이렉트는 useEffect에서 role 기준으로 처리
    } else {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: result.error || "아이디 또는 비밀번호를 확인하세요.",
      });
    }
    setIsLoading(false);
  };

  const handleQuickLogin = (userType: "worker" | "admin") => {
    if (userType === "worker") {
      setId("worker1");
      setPassword("1234");
    } else {
      setId("admin");
      setPassword("admin");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 섹션 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">HOLMZ</h1>
          <p className="text-muted-foreground">스케줄 관리 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <Card className="bg-card border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-card-foreground">
              로그인
            </CardTitle>
            <p className="text-center text-muted-foreground">
              아이디와 비밀번호를 입력하세요
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="id" className="text-card-foreground">
                  아이디
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="id"
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="아이디를 입력하세요"
                    className="pl-9 bg-input border-border text-foreground"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">
                  비밀번호
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="pl-9 bg-input border-border text-foreground"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    로그인
                  </>
                )}
              </Button>
            </form>

            {/* 빠른 로그인 */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground text-center mb-4">
                빠른 로그인
              </p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => handleQuickLogin("worker")}
                  disabled={isLoading}
                >
                  <span>근무자 로그인 (worker1 / 1234)</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => handleQuickLogin("admin")}
                  disabled={isLoading}
                >
                  <span>관리자 로그인 (admin / admin)</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 하단 정보 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                계정이 없나요?{" "}
                <span className="text-primary hover:underline cursor-pointer">
                  관리자에게 문의하세요
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 버전 표기 */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>HOLMZ Schedule Management v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
