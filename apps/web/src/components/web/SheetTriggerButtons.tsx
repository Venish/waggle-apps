"use client";

import { useRouter } from "next/navigation";
import { PointIcon } from "@repo/ui";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import { deleteDogAction } from "@/03_actions/web/dogDailyActions";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { DogProfileFormClient, type EditableDogProfile } from "@/components/web/DogProfileFormClient";
import { NewInquiryFormClient } from "@/components/web/NewInquiryFormClient";
import { RechargeClient } from "@/components/web/RechargeClient";
import { AppButton } from "@/components/web/ui";

/**
 * 어디서든 페이지 이탈 없이 인라인 충전 시트를 띄우는 공용 훅
 * - 충전 완료 시 시트만 닫고 onRecharged + router.refresh()로 현재 화면/열린 시트 잔액을 0ms 갱신한다.
 */
export function useInlineRechargeSheet() {
  const router = useRouter();
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);
  const openAlert = useWebAlertStore((s) => s.openAlert);

  return ({
    packages,
    walletBalance,
    requiredShortfall,
    onRecharged,
  }: {
    packages: RechargePackagePolicy[];
    walletBalance: number;
    requiredShortfall?: number;
    onRecharged?: (pointAmount: number) => void;
  }) => {
    openModal({
      id: "inline-point-recharge-sheet",
      title: "포인트 충전",
      subtitle: "충전 완료 후 현재 화면으로 바로 돌아옵니다",
      direction: "slide-up",
      content: (
        <RechargeClient
          packages={packages}
          walletBalance={walletBalance}
          requiredShortfall={requiredShortfall}
          onCompleted={({ pointAmount }) => {
            closeTopModal();
            onRecharged?.(pointAmount);
            openAlert({
              title: `+${pointAmount.toLocaleString("ko-KR")} P 충전 완료`,
              description: "보유 포인트가 즉시 반영되었습니다.",
            });
          }}
        />
      ),
    });
  };
}

/**
 * 쇼핑(상품 상세·장바구니·주문서) 및 Q&A 공용 1줄 보유 포인트 & 즉시 충전 시트 스트립
 * - 충전 완료 시 영수증 페이지로 이동하지 않고 시트만 닫고 현재 화면 잔액을 즉시 갱신한다.
 */
export function PointBalanceRechargeStrip({
  walletBalance,
  requiredPoint,
  packages,
  onRecharged,
  onOpenRecharge,
}: {
  walletBalance: number;
  requiredPoint?: number;
  packages: RechargePackagePolicy[];
  onRecharged?: (pointAmount: number) => void;
  onOpenRecharge?: () => void;
}) {
  const openInlineRecharge = useInlineRechargeSheet();

  const shortfall =
    requiredPoint !== undefined && requiredPoint > walletBalance
      ? requiredPoint - walletBalance
      : 0;

  const handleOpenRecharge = () => {
    if (onOpenRecharge) {
      onOpenRecharge();
      return;
    }
    openInlineRecharge({
      packages,
      walletBalance,
      requiredShortfall: shortfall > 0 ? shortfall : undefined,
      onRecharged,
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <PointIcon className="size-4 shrink-0 text-brand" />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium text-ink-muted">보유 포인트</span>
          <span className="text-sm font-extrabold tabular-nums text-ink">
            {walletBalance.toLocaleString("ko-KR")} P
          </span>
          {shortfall > 0 && (
            <span className="text-xs font-semibold tabular-nums text-destructive">
              ({shortfall.toLocaleString("ko-KR")}P 부족)
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpenRecharge}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl border border-brand bg-transparent px-3 text-xs font-bold text-brand-strong transition-[transform,background-color] duration-150 hover:bg-brand-soft active:scale-[0.97]"
      >
        충전
      </button>
    </div>
  );
}

export function WalletRechargeSheetButton({
  packages,
  walletBalance,
}: {
  packages: RechargePackagePolicy[];
  walletBalance?: number;
}) {
  const openModal = useModalStore((s) => s.openModal);

  return (
    <AppButton
      variant="primary"
      size="md"
      onClick={() =>
        openModal({
          id: "wallet-recharge-sheet",
          title: "포인트 충전",
          subtitle: "충전할 패키지를 선택해 주세요",
          direction: "slide-up",
          content: <RechargeClient packages={packages} walletBalance={walletBalance} />,
        })
      }
    >
      포인트 충전
    </AppButton>
  );
}

export function InquiryNewSheetButton({
  dogs,
  inquiryPrice,
  walletBalance,
  availableTickets = [],
  rechargePackages = [],
  label = "질문 작성",
  size = "sm",
  fullWidth = false,
}: {
  dogs: Array<{ id: number; name: string }>;
  inquiryPrice: number;
  walletBalance: number;
  availableTickets?: Array<{ id: number; title: string }>;
  rechargePackages?: RechargePackagePolicy[];
  label?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const openModal = useModalStore((s) => s.openModal);

  return (
    <AppButton
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      onClick={() =>
        openModal({
          id: "inquiry-new-sheet",
          title: "영상 Q&A 작성",
          subtitle: "48시간 내 전문 훈련사가 맞춤 답변을 드려요",
          direction: "slide-up",
          content: (
            <NewInquiryFormClient
              dogs={dogs}
              inquiryPrice={inquiryPrice}
              walletBalance={walletBalance}
              availableTickets={availableTickets}
              rechargePackages={rechargePackages}
              inlineRechargeMode="step"
            />
          ),
        })
      }
    >
      {label}
    </AppButton>
  );
}

export function AddDogSheetButton({
  breeds,
  label = "추가",
  size = "sm",
  fullWidth = false,
}: {
  breeds: Array<{ id: number; nameKo: string; defaultSize: "SMALL" | "MEDIUM" | "LARGE" }>;
  label?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);

  return (
    <AppButton
      variant="primary"
      size={size}
      fullWidth={fullWidth}
      onClick={() =>
        openModal({
          id: "my-dogs-add-sheet",
          title: "새 반려견 추가",
          subtitle: "다견 가정도 반려견별로 학습·일상을 관리할 수 있어요",
          direction: "slide-up",
          content: (
            <DogProfileFormClient
              breeds={breeds}
              redirectAfter="/app/my/dogs"
              submitLabel="반려견 추가 등록"
              onSuccess={closeTopModal}
            />
          ),
        })
      }
    >
      {label}
    </AppButton>
  );
}

export function EditDogSheetButton({
  dog,
  breeds,
}: {
  dog: EditableDogProfile;
  breeds: Array<{ id: number; nameKo: string; defaultSize: "SMALL" | "MEDIUM" | "LARGE" }>;
}) {
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);

  return (
    <AppButton
      variant="secondary"
      size="xs"
      onClick={() =>
        openModal({
          id: `my-dogs-edit-sheet-${dog.id}`,
          title: `${dog.name} 프로필 수정`,
          subtitle: "사진과 기본 정보를 언제든 업데이트할 수 있어요",
          direction: "slide-up",
          content: (
            <DogProfileFormClient
              breeds={breeds}
              initialDog={dog}
              redirectAfter="/app/my/dogs"
              submitLabel="변경 내용 저장"
              onSuccess={closeTopModal}
            />
          ),
        })
      }
    >
      수정
    </AppButton>
  );
}

export function DeleteDogButton({
  dogId,
  dogName,
  isPrimary,
  enrollmentCount,
  dailyEntryCount,
  activeInquiryCount,
}: {
  dogId: number;
  dogName: string;
  isPrimary: boolean;
  enrollmentCount: number;
  dailyEntryCount: number;
  activeInquiryCount: number;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const { pending, run } = useSubmitLock();

  const handleDeleteClick = () => {
    if (activeInquiryCount > 0) {
      openAlert({
        title: "진행 중인 1:1 영상 Q&A가 있어요",
        description: `답변 대기 중인 Q&A(${activeInquiryCount}건)가 있어 ${dogName} 프로필을 삭제할 수 없습니다. 답변 완료 또는 문의 취소 후 다시 시도해 주세요.`,
        tone: "destructive",
      });
      return;
    }

    const summaryParts: string[] = [];
    if (enrollmentCount > 0) summaryParts.push(`수강 코스 ${enrollmentCount}개`);
    if (dailyEntryCount > 0) summaryParts.push(`데일리 기록 ${dailyEntryCount}건`);

    const impactText =
      summaryParts.length > 0
        ? `연결된 ${summaryParts.join(" · ")}은 앱에서 숨김 처리됩니다. 보유 포인트·주문·완료된 Q&A 내역은 유지되며, 실수로 삭제한 경우 고객센터를 통해 복원할 수 있습니다.`
        : "삭제된 반려견 프로필은 앱에서 숨김 처리되며, 실수로 삭제한 경우 고객센터를 통해 복원할 수 있습니다.";

    const primaryNote = isPrimary
      ? "\n대표견 삭제 시 다른 등록 반려견이 자동으로 대표견으로 전환됩니다."
      : "";

    openAlert({
      title: `${dogName} 프로필을 삭제할까요?`,
      description: `${impactText}${primaryNote}`,
      confirmLabel: "삭제하기",
      cancelLabel: "취소",
      tone: "destructive",
      onConfirm: () => {
        void run(async () => {
          const res = await deleteDogAction(dogId);
          if (!res.ok) {
            openAlert({
              title: "반려견 삭제 불가",
              description: res.error.message,
              tone: "destructive",
            });
            return;
          }
          router.refresh();
          openAlert({
            title: `${res.data.deletedName} 프로필이 삭제되었습니다`,
            description: res.data.promotedName
              ? `${res.data.promotedName}이(가) 새 대표견으로 자동 지정되었습니다.`
              : undefined,
          });
        });
      },
    });
  };

  return (
    <AppButton variant="danger" size="xs" loading={pending} onClick={handleDeleteClick}>
      삭제
    </AppButton>
  );
}
