import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Building2, User, KeyRound } from "lucide-react";
import { useLogin } from "@/features/authentication/useLogin";

const Login: React.FC = () => {
  const {
    id,
    setId,
    password,
    setPassword,
    isLoading,
    handleSubmit,
  } = useLogin();

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
