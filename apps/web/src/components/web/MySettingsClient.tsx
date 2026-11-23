"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeUserPasswordAction,
  updateUserSettingsAction,
  userLogoutAction,
} from "@/03_actions/web/authActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { AppButton, AppInput, AppSwitch } from "@/components/web/ui";

export function MySettingsClient({
  initialNickname,
  initialRegion,
  initialPushOptIn,
  initialEducationPushOptIn,
  initialMarketingOptIn,
}: {
  initialNickname: string;
  initialRegion: string;
  initialPushOptIn: boolean;
  initialEducationPushOptIn: boolean;
  initialMarketingOptIn: boolean;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [nickname, setNickname] = useState(initialNickname);
  const [region, setRegion] = useState(initialRegion);
  const [pushOptIn, setPushOptIn] = useState(initialPushOptIn);
  const [educationPushOptIn, setEducationPushOptIn] = useState(initialEducationPushOptIn);
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pendingProfile, setPendingProfile] = useState(false);
  const [pendingPw, setPendingPw] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingProfile(true);
    try {
      const res = await updateUserSettingsAction({
        nickname,
        region,
        pushOptIn,
        educationPushOptIn,
        marketingOptIn,
      });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      setNickname(res.data.nickname);
      openAlert({ title: "설정이 저장되었습니다" });
      router.refresh();
    } finally {
      setPendingProfile(false);
    }
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingPw(true);
    try {
      const res = await changeUserPasswordAction({ currentPassword, newPassword });
      if (!res.ok) {
        openAlert({ title: "비밀번호 변경 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      openAlert({
        title: "비밀번호가 변경되었습니다",
        description: "보안을 위해 기존 세션이 초기화되고 현재 기기에 새 세션이 발급되었습니다.",
      });
    } finally {
      setPendingPw(false);
    }
  };

  const handleLogout = async () => {
    await userLogoutAction();
    router.push("/app/onboarding/login");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={handleSaveProfile} className="space-y-5">
        <h2 className="text-base font-bold tracking-tight text-ink">프로필 및 알림 설정</h2>

        <AppInput
          label="닉네임"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          clearable
          onClear={() => setNickname("")}
          placeholder="비워두면 waggle_고유코드로 자동 설정"
        />

        <AppInput
          label="활동 지역"
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          clearable
          onClear={() => setRegion("")}
          placeholder="예: 서울 강남구"
        />

        <div className="divide-y divide-border-subtle border-y border-border-subtle">
          <AppSwitch
            checked={pushOptIn}
            onChange={setPushOptIn}
            label="전체 푸시 알림"
            description="답변 완료, 주문 상태, 포인트 소멸 안내"
          />
          <AppSwitch
            checked={educationPushOptIn}
            onChange={setEducationPushOptIn}
            label="데일리 교육 리마인드"
            description="설정한 시각에 오늘의 강의 목표 알림"
          />
          <AppSwitch
            checked={marketingOptIn}
            onChange={setMarketingOptIn}
            label="혜택 · 마케팅 알림"
            description="신규 강좌 오픈 및 포인트샵 이벤트 소식"
          />
        </div>

        <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pendingProfile}>
          설정 저장
        </AppButton>
      </form>

      <div className="-mx-4 h-2 bg-surface-subtle" />

      <form noValidate onSubmit={handleChangePw} className="space-y-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-ink">비밀번호 변경</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            변경 즉시 다른 기기의 활성 세션이 모두 종료됩니다.
          </p>
        </div>

        <AppInput
          label="현재 비밀번호"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="현재 비밀번호 입력"
        />
        <AppInput
          label="새 비밀번호"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8자 이상 입력"
        />

        <AppButton type="submit" variant="secondary" size="md" fullWidth loading={pendingPw}>
          비밀번호 변경
        </AppButton>
      </form>

      <div className="-mx-4 h-2 bg-surface-subtle" />

      <AppButton type="button" variant="danger" size="md" fullWidth onClick={handleLogout}>
        로그아웃
      </AppButton>
    </div>
  );
}
