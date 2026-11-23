"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Smartphone } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import {
  adminLoginStep1Action,
  adminLoginStep2VerifyOtpAction,
} from "@/03_actions/admin/adminAuthActions";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

export function AdminLoginClient() {
  const router = useRouter();
  const openAlert = useAdminAlertStore((s) => s.openAlert);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [devMockOtp, setDevMockOtp] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await adminLoginStep1Action({ email, password });
      if (!res.ok) {
        openAlert({ title: "로그인 실패", description: res.error.message, tone: "negative" });
        return;
      }
      setMaskedPhone(res.data.maskedPhone);
      setDevMockOtp(res.data.devMockOtp);
      setStep(2);
    } finally {
      setPending(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await adminLoginStep2VerifyOtpAction(otpCode);
      if (!res.ok) {
        openAlert({ title: "OTP 인증 실패", description: res.error.message, tone: "negative" });
        return;
      }
      router.push(res.data.redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-auth bg-base-2 p-6 shadow-lg atlas-border">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-inverse text-on-inverse">
            <WaggleMark className="h-4.5 w-auto" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-neutral">Waggle Admin Console</h1>
            <p className="text-xs text-subdued">Atlas Precision Studio · 2FA SMS 인증</p>
          </div>
        </div>

        {step === 1 ? (
          <form noValidate onSubmit={handleStep1} className="mt-5 space-y-3">
            <div>
              <label htmlFor="adm-email" className="block text-xs font-medium text-secondary">
                관리자 이메일
              </label>
              <input
                id="adm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@waggle.kr"
                className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 text-sm text-neutral atlas-border focus:outline-2 focus:outline-accent"
              />
            </div>

            <div>
              <label htmlFor="adm-pw" className="block text-xs font-medium text-secondary">
                비밀번호
              </label>
              <input
                id="adm-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 text-sm text-neutral atlas-border focus:outline-2 focus:outline-accent"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-menu bg-inverse text-sm font-medium text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-45"
            >
              <KeyRound className="size-4" strokeWidth={1.75} />
              {pending ? "검증 및 OTP 발송 중..." : "1단계 로그인 (SMS OTP 발송)"}
            </button>

            <div className="grid grid-cols-2 gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@waggle.kr");
                  setPassword("Admin1234!");
                }}
                className="h-7 rounded-control px-2 text-xs font-medium text-secondary atlas-border hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
              >
                운영자 자동입력
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("trainer@waggle.kr");
                  setPassword("Trainer1234!");
                }}
                className="h-7 rounded-control px-2 text-xs font-medium text-secondary atlas-border hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
              >
                훈련사 자동입력
              </button>
            </div>
          </form>
        ) : (
          <form noValidate onSubmit={handleStep2} className="mt-5 space-y-3">
            <div className="rounded-control bg-base-1 p-3 text-xs text-secondary atlas-border">
              <p className="flex items-center gap-1.5 font-medium text-neutral">
                <Smartphone className="size-3.5 text-info" strokeWidth={1.75} />
                {maskedPhone} 으로 6자리 인증번호가 발송되었습니다.
              </p>
              {devMockOtp && (
                <p className="mt-2 rounded-badge bg-info/15 px-2 py-1 font-mono text-xs font-semibold text-info tabular-nums">
                  [개발 Mock SMS OTP]: {devMockOtp}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="adm-otp" className="block text-xs font-medium text-secondary">
                인증번호 6자리
              </label>
              <input
                id="adm-otp"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="000000"
                className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 font-mono text-sm tracking-widest tabular-nums text-neutral atlas-border focus:outline-2 focus:outline-accent"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-8 rounded-menu px-3 text-control font-medium text-secondary atlas-border hover:text-neutral"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex h-8 flex-1 items-center justify-center rounded-menu bg-inverse text-sm font-medium text-on-inverse hover:opacity-90 disabled:opacity-45"
              >
                {pending ? "인증 확인 중..." : "2단계 인증 완료 및 로그인"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-4 text-xs text-subdued">
          30분 슬라이딩 만료 · 단일 세션 · 5회 오답 시 계정 잠금 적용
        </p>
      </div>
    </div>
  );
}
