"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WaggleMark } from "@repo/ui";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { completeOnboardingExtraAction } from "@/03_actions/web/authActions";
import { PawTrailBackdrop } from "@/components/web/AuthBrandPrimitives";
import { AppButton, AppCheckbox, AppInput } from "@/components/web/ui";

export function OnboardingExtraClient({
  initialNickname = "",
  initialPhone = "",
}: {
  initialNickname?: string;
  initialPhone?: string;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [phone, setPhone] = useState(initialPhone);
  const [isPending, setIsPending] = useState(false);

  const nickRef = useRef<HTMLInputElement>(null);
  const allAgreed = agreedTerms && marketingOptIn;

  const handleToggleAll = (checked: boolean) => {
    setAgreedTerms(checked);
    setMarketingOptIn(checked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedTerms) {
      openAlert({ title: "필수 이용약관에 동의해 주세요" });
      return;
    }
    if (nickname.trim().length === 1) {
      openAlert({
        title: "닉네임은 2자 이상 입력해 주세요",
        onConfirm: () => setTimeout(() => nickRef.current?.focus(), 80),
      });
      return;
    }

    setIsPending(true);
    try {
      const res = await completeOnboardingExtraAction({
        nickname,
        phone,
        agreedTerms: true,
        marketingOptIn,
      });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
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
          <div className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              약관 동의 및 추가 정보
            </h1>
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-6">
            {/* 약관 동의 (기본 미체크 + 전체 동의 좌측 축 1:1 정렬) */}
            <div>
              <div className="border-b border-border-subtle pb-1">
                <AppCheckbox
                  checked={allAgreed}
                  onChange={handleToggleAll}
                  label="약관 전체 동의"
                  className="py-3"
                  labelClassName="text-base font-bold text-ink"
                />
              </div>
              <div className="pt-1">
                <AppCheckbox
                  checked={agreedTerms}
                  onChange={setAgreedTerms}
                  label="[필수] 이용약관 및 개인정보처리방침 동의"
                  className="py-2.5"
                />
                <AppCheckbox
                  checked={marketingOptIn}
                  onChange={setMarketingOptIn}
                  label="[선택] 혜택·이벤트 마케팅 알림 수신 동의"
                  className="py-2.5"
                />
              </div>
            </div>

            {/* 추가 정보 */}
            <div className="space-y-4">
              <AppInput
                ref={nickRef}
                id="extra-nick"
                label="보호자 닉네임"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                clearable
                onClear={() => setNickname("")}
                placeholder="미입력 시 자동 설정"
              />

              <AppInput
                id="extra-phone"
                label="연락처"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="tabular-nums"
              />
            </div>

            <div className="pt-2">
              <AppButton type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
                {isPending ? "저장 중..." : "다음"}
              </AppButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
