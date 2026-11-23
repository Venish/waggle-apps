"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WaggleMark } from "@repo/ui";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { userLoginAction } from "@/03_actions/web/authActions";
import { PawTrailBackdrop, SocialAuthIconRow } from "@/components/web/AuthBrandPrimitives";
import { AppButton, AppInput, AppLink } from "@/components/web/ui";

export function LoginFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "duplicate") {
      openAlert({
        title: "다른 기기에서 로그인되었습니다",
        description:
          "와글은 보안을 위해 단일 기기 로그인만 지원합니다. 계속 이용하려면 다시 로그인해 주세요.",
        confirmLabel: "확인",
        tone: "destructive",
      });
    } else if (reason === "suspended") {
      openAlert({
        title: "계정 이용이 제한되었습니다",
        description: "관리자에 의해 정지되었거나 세션이 초기화되었습니다.",
        confirmLabel: "확인",
        tone: "destructive",
      });
    }
  }, [searchParams, openAlert]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      openAlert({
        title: "이메일을 입력해 주세요",
        onConfirm: () => setTimeout(() => emailRef.current?.focus(), 80),
      });
      return;
    }
    if (!password) {
      openAlert({
        title: "비밀번호를 입력해 주세요",
        onConfirm: () => setTimeout(() => passwordRef.current?.focus(), 80),
      });
      return;
    }

    setIsPending(true);
    try {
      const res = await userLoginAction({ email, password });
      if (!res.ok) {
        openAlert({
          title: "로그인 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PawTrailBackdrop animated />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="space-y-10">
          {/* 브랜드 헤더 (80px 스퀘어클 WaggleMark + H1 인사) */}
          <div className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              반가워요, 보호자님
            </h1>
          </div>

          <div className="space-y-7">
            {/* 이메일 로그인 폼 */}
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <AppInput
                ref={emailRef}
                id="user-email"
                label="이메일"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                clearable
                onClear={() => setEmail("")}
                placeholder="name@example.com"
              />

              <AppInput
                ref={passwordRef}
                id="user-password"
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
              />

              <div className="pt-2">
                <AppButton type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
                  {isPending ? "로그인 중..." : "로그인"}
                </AppButton>
              </div>
            </form>

            {/* 간편 로그인 (카카오 · Apple 로고 단독 원형 버튼) */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border-subtle" />
                <span className="text-xs font-medium text-ink-muted">간편 로그인</span>
                <span className="h-px flex-1 bg-border-subtle" />
              </div>

              <SocialAuthIconRow mode="login" />
            </div>

            <p className="text-center text-xs text-ink-muted">
              아직 계정이 없으신가요?{" "}
              <AppLink
                href="/app/onboarding/signup"
                className="font-bold text-ink underline underline-offset-4"
              >
                회원가입
              </AppLink>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
