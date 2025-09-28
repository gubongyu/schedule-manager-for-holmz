import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useLogin = () => {
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
    } else {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: result.error || "아이디 또는 비밀번호를 확인하세요.",
      });
    }
    setIsLoading(false);
  };

  return {
    id,
    setId,
    password,
    setPassword,
    isLoading,
    handleSubmit,
  };
};