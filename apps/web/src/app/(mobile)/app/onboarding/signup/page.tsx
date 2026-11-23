"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WaggleMark } from "@repo/ui";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { userSignupAction } from "@/03_actions/web/authActions";
import { PawTrailBackdrop, SocialAuthIconRow } from "@/components/web/AuthBrandPrimitives";
import { AppButton, AppInput, AppLink } from "@/components/web/ui";

export default function OnboardingSignupPage() {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [step, setStep] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isPending, setIsPending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const pwConfirmRef = useRef<HTMLInputElement>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      openAlert({
        title: "이메일을 입력해 주세요",
        onConfirm: () => setTimeout(() => emailRef.current?.focus(), 80),
      });
      return;
    }
    if (password.length < 8) {
      openAlert({
        title: "비밀번호는 8자 이상 입력해 주세요",
        onConfirm: () => setTimeout(() => pwRef.current?.focus(), 80),
      });
      return;
    }
    if (password !== passwordConfirm) {
      openAlert({
        title: "비밀번호가 일치하지 않아요",
        onConfirm: () => setTimeout(() => pwConfirmRef.current?.focus(), 80),
      });
      return;
    }

    setIsPending(true);
    try {
      const res = await userSignupAction({
        email,
        password,
        nickname: "",
        marketingOptIn: false,
      });
      if (!res.ok) {
        openAlert({ title: "회원가입 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  if (step === "email") {
    return (
      <>
        <PawTrailBackdrop animated />

        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="space-y-10">
            <div className="flex flex-col items-center text-center">
              <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
                <WaggleMark className="w-[56%]" />
              </span>
              <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
                이메일과 비밀번호를 입력해 주세요
              </h1>
            </div>

            <form noValidate onSubmit={handleEmailSubmit} className="space-y-4">
              <AppInput
                ref={emailRef}
                id="su-email"
                label="이메일"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                clearable
                onClear={() => setEmail("")}
                placeholder="name@example.com"
              />

              <AppInput
                ref={pwRef}
                id="su-pw"
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상 입력"
              />

              <AppInput
                ref={pwConfirmRef}
                id="su-pw-confirm"
                label="비밀번호 확인"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
              />

              <div className="space-y-2 pt-3">
                <AppButton type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
                  {isPending ? "확인 중..." : "다음"}
                </AppButton>
                <AppButton
                  type="button"
                  variant="ghost"
                  size="md"
                  fullWidth
                  disabled={isPending}
                  onClick={() => setStep("choose")}
                >
                  돌아가기
                </AppButton>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PawTrailBackdrop animated />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="space-y-10">
          <div className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              가입 방법을 선택해 주세요
            </h1>
          </div>

          <div className="space-y-7">
            <div className="space-y-5">
              <AppButton
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep("email")}
              >
                이메일로 가입하기
              </AppButton>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border-subtle" />
                  <span className="text-xs font-medium text-ink-muted">간편 가입</span>
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>

                <SocialAuthIconRow mode="signup" />
              </div>
            </div>

            <p className="text-center text-xs text-ink-muted">
              이미 계정이 있나요?{" "}
              <AppLink
                href="/app/onboarding/login"
                className="font-bold text-ink underline underline-offset-4"
              >
                로그인
              </AppLink>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
