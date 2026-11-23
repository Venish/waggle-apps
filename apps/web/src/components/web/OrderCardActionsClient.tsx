"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderAddressSnapshot } from "@repo/db";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  cancelMyOrderAction,
  confirmMyOrderAction,
  requestOrderCancelOrReturnAction,
  updateMyOrderAddressAction,
  withdrawOrderRequestAction,
} from "@/03_actions/web/walletShopActions";
import type { ShopReviewPolicy } from "@/04_services/shared/policyService";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { ProductReviewSheetForm } from "@/components/web/ProductReviewSheetForm";
import { AppButton, AppCheckbox, AppChip, AppInput, AppTextarea } from "@/components/web/ui";

const CANCEL_PRESETS = ["단순 변심", "옵션·수량 변경", "배송지 오입력"] as const;
const RETURN_PRESETS = ["단순 변심", "상품 파손·불량", "오배송"] as const;

function EditAddressSheetForm({
  orderId,
  initial,
  onDone,
}: {
  orderId: number;
  initial: OrderAddressSnapshot;
  onDone: () => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [receiver, setReceiver] = useState(initial.receiver);
  const [phone, setPhone] = useState(initial.phone);
  const [zipcode, setZipcode] = useState(initial.zipcode);
  const [addr1, setAddr1] = useState(initial.addr1);
  const [addr2, setAddr2] = useState(initial.addr2 ?? "");
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const { pending, run } = useSubmitLock();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await updateMyOrderAddressAction({
        orderId,
        receiver,
        phone,
        zipcode,
        addr1,
        addr2,
        saveAsDefault,
      });
      if (!res.ok) {
        openAlert({ title: "배송지 변경 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      onDone();
      router.refresh();
      openAlert({
        title: "배송지가 변경되었습니다",
        description: "변경된 배송지로 안전하게 발송 준비해 드릴게요.",
      });
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <AppInput
        id="edit-addr-receiver"
        label="수령인 *"
        value={receiver}
        onChange={(e) => setReceiver(e.target.value)}
        clearable
        onClear={() => setReceiver("")}
      />
      <AppInput
        id="edit-addr-phone"
        label="연락처 *"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        clearable
        onClear={() => setPhone("")}
        className="tabular-nums"
      />
      <AppInput
        id="edit-addr-zipcode"
        label="우편번호 *"
        inputMode="numeric"
        value={zipcode}
        onChange={(e) => setZipcode(e.target.value)}
        className="tabular-nums"
      />
      <AppInput
        id="edit-addr-1"
        label="기본 주소 *"
        value={addr1}
        onChange={(e) => setAddr1(e.target.value)}
      />
      <AppInput
        id="edit-addr-2"
        label="상세 주소"
        value={addr2}
        onChange={(e) => setAddr2(e.target.value)}
        placeholder="동·호수 등 상세 주소"
      />

      <AppCheckbox
        checked={saveAsDefault}
        onChange={setSaveAsDefault}
        label="다음 주문에도 이 배송지 기본 사용"
      />

      <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {pending ? "저장 중..." : "배송지 저장"}
      </AppButton>
    </form>
  );
}

function OrderClaimRequestSheetForm({
  orderId,
  mode,
  onDone,
}: {
  orderId: number;
  mode: "CANCEL" | "RETURN";
  onDone: () => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const presets = mode === "CANCEL" ? CANCEL_PRESETS : RETURN_PRESETS;
  const [reason, setReason] = useState<string>(presets[0]);
  const { pending, run } = useSubmitLock();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await requestOrderCancelOrReturnAction({ orderId, reason });
      if (!res.ok) {
        openAlert({ title: "신청 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      onDone();
      router.refresh();
      openAlert({
        title: mode === "CANCEL" ? "취소 신청이 접수되었습니다" : "반품 · 환불 신청이 접수되었습니다",
        description: "운영팀 확인 후 승인 시 결제 포인트가 지갑으로 전액 환불됩니다.",
      });
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-muted">사유 선택</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <AppChip key={p} selected={reason === p} onClick={() => setReason(p)}>
              {p}
            </AppChip>
          ))}
        </div>
      </div>

      <AppTextarea
        id="order-claim-reason"
        label="상세 사유 *"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="사유를 입력해 주세요"
      />

      <div className="rounded-2xl bg-surface-subtle px-4 py-3 text-xs leading-relaxed text-ink-muted">
        {mode === "CANCEL"
          ? "• 이미 출고가 시작된 경우 취소 요청이 반려되고 배송이 진행될 수 있습니다."
          : "• 실물 상품 회수 및 검수 확인 후 결제 시 사용한 포인트가 전액 환불됩니다."}
      </div>

      <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {pending ? "접수 중..." : mode === "CANCEL" ? "취소 신청 접수" : "반품 · 환불 신청 접수"}
      </AppButton>
    </form>
  );
}

export interface OrderReviewItemMeta {
  orderItemId: number;
  productId: number;
  nameSnap: string;
  existingReview: {
    id: number;
    rating: number;
    content: string;
    imageUrls: string[];
  } | null;
}

export function OrderCardActionsClient({
  orderId,
  orderNo,
  status,
  hasShipment,
  canReturn,
  canCancelDigital = false,
  addressSnapshot,
  physicalReviewItems = [],
  reviewPolicy,
}: {
  orderId: number;
  orderNo: string;
  status: string;
  hasShipment: boolean;
  canReturn: boolean;
  canCancelDigital?: boolean;
  addressSnapshot: OrderAddressSnapshot;
  physicalReviewItems?: OrderReviewItemMeta[];
  reviewPolicy?: ShopReviewPolicy;
}) {
  const router = useRouter();
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const { pending, run } = useSubmitLock();

  const handleInstantCancel = () => {
    if (pending) return;
    openAlert({
      title: "주문을 취소할까요?",
      description: "결제 시 차감된 포인트가 지갑으로 즉시 전액 환불됩니다.",
      confirmLabel: "주문 취소",
      cancelLabel: "유지",
      tone: "destructive",
      onConfirm: () => {
        void run(async () => {
          const res = await cancelMyOrderAction(orderId);
          if (!res.ok) {
            openAlert({ title: "취소 불가", description: res.error.message, tone: "destructive" });
            return;
          }
          router.refresh();
          openAlert({
            title: "주문이 취소되었습니다",
            description: `${res.data.refundedPoints.toLocaleString("ko-KR")}P가 지갑으로 환불되었습니다.`,
          });
        });
      },
    });
  };

  const handleOpenAddressSheet = () => {
    openModal({
      id: `order-address-${orderId}`,
      title: "배송지 변경",
      subtitle: `주문번호 ${orderNo} · 배송 준비 전까지 변경 가능`,
      direction: "slide-up",
      content: (
        <EditAddressSheetForm
          orderId={orderId}
          initial={addressSnapshot}
          onDone={closeTopModal}
        />
      ),
    });
  };

  const handleOpenClaimSheet = (mode: "CANCEL" | "RETURN") => {
    openModal({
      id: `order-claim-${orderId}`,
      title: mode === "CANCEL" ? "주문 취소 신청" : "반품 · 환불 신청",
      subtitle: `주문번호 ${orderNo}`,
      direction: "slide-up",
      content: (
        <OrderClaimRequestSheetForm orderId={orderId} mode={mode} onDone={closeTopModal} />
      ),
    });
  };

  const handleWithdraw = () => {
    if (pending) return;
    openAlert({
      title: "요청을 철회할까요?",
      description: "접수된 취소·반품 신청을 철회하고 이전 상태로 되돌립니다.",
      confirmLabel: "요청 철회",
      cancelLabel: "닫기",
      onConfirm: () => {
        void run(async () => {
          const res = await withdrawOrderRequestAction(orderId);
          if (!res.ok) {
            openAlert({ title: "철회 실패", description: res.error.message, tone: "destructive" });
            return;
          }
          router.refresh();
        });
      },
    });
  };

  const handleConfirmPurchase = () => {
    if (pending) return;
    openAlert({
      title: "구매를 확정할까요?",
      description:
        "구매 확정 후에는 반품·환불이 불가능하며, 바로 상품 후기를 작성하고 포인트를 적립할 수 있어요.",
      confirmLabel: "구매 확정",
      cancelLabel: "취소",
      onConfirm: () => {
        void run(async () => {
          const res = await confirmMyOrderAction(orderId);
          if (!res.ok) {
            openAlert({
              title: "구매 확정 실패",
              description: res.error.message,
              tone: "destructive",
            });
            return;
          }
          router.refresh();
          openAlert({
            title: "구매가 확정되었습니다",
            description: "지금 바로 상품 후기를 작성하고 감사 포인트를 받아보세요!",
          });
        });
      },
    });
  };

  const handleOpenReviewSheet = (item: OrderReviewItemMeta) => {
    if (!reviewPolicy) return;
    if (item.existingReview) {
      openModal({
        id: `order-edit-review-${item.existingReview.id}`,
        title: "상품 후기 수정",
        subtitle: item.nameSnap,
        direction: "slide-up",
        content: (
          <ProductReviewSheetForm
            mode="edit"
            productName={item.nameSnap}
            policy={reviewPolicy}
            existingReview={item.existingReview}
            onDone={closeTopModal}
          />
        ),
      });
      return;
    }

    openModal({
      id: `order-write-review-${item.orderItemId}`,
      title: "상품 후기 작성",
      subtitle: `주문번호 ${orderNo}`,
      direction: "slide-up",
      content: (
        <ProductReviewSheetForm
          mode="create"
          productName={item.nameSnap}
          policy={reviewPolicy}
          eligibleOrderItems={[
            { orderItemId: item.orderItemId, orderNo, nameSnap: item.nameSnap },
          ]}
          onDone={closeTopModal}
        />
      ),
    });
  };

  if (status === "PAID") {
    return (
      <div className={`mt-3 grid gap-2 ${hasShipment ? "grid-cols-2" : "grid-cols-1"}`}>
        {hasShipment && (
          <AppButton variant="outline" size="sm" onClick={handleOpenAddressSheet}>
            배송지 변경
          </AppButton>
        )}
        <AppButton variant="danger" size="sm" loading={pending} onClick={handleInstantCancel}>
          {pending ? "취소 중..." : "주문 취소"}
        </AppButton>
      </div>
    );
  }

  if (status === "PREPARING") {
    return (
      <div className="mt-3">
        <AppButton variant="outline" size="sm" fullWidth onClick={() => handleOpenClaimSheet("CANCEL")}>
          취소 신청 (관리자 확인)
        </AppButton>
      </div>
    );
  }

  if (status === "DELIVERED" && !hasShipment && canCancelDigital) {
    return (
      <div className="mt-3">
        <AppButton variant="danger" size="sm" fullWidth loading={pending} onClick={handleInstantCancel}>
          {pending ? "취소 중..." : "미사용 티켓 주문 취소"}
        </AppButton>
      </div>
    );
  }

  if (status === "DELIVERED" && hasShipment) {
    return (
      <div className={`mt-3 grid gap-2 ${canReturn ? "grid-cols-2" : "grid-cols-1"}`}>
        <AppButton variant="primary" size="sm" loading={pending} onClick={handleConfirmPurchase}>
          {pending ? "확정 중..." : "구매 확정"}
        </AppButton>
        {canReturn && (
          <AppButton variant="outline" size="sm" onClick={() => handleOpenClaimSheet("RETURN")}>
            반품 신청
          </AppButton>
        )}
      </div>
    );
  }

  if (status === "CONFIRMED" && physicalReviewItems.length > 0 && reviewPolicy) {
    const maxReward = Math.max(reviewPolicy.textRewardPoint, reviewPolicy.photoRewardPoint);
    return (
      <div className="mt-3 space-y-2">
        {physicalReviewItems.map((item) =>
          item.existingReview ? (
            <button
              key={item.orderItemId}
              type="button"
              onClick={() => handleOpenReviewSheet(item)}
              className="flex h-9 w-full items-center justify-center rounded-xl bg-surface text-xs font-semibold text-ink-muted ring-1 ring-ink/[0.08] transition-[background-color,color] duration-150 hover:text-ink"
            >
              {physicalReviewItems.length > 1
                ? `${item.nameSnap} 후기 수정`
                : "작성한 후기 수정"}
            </button>
          ) : (
            <AppButton
              key={item.orderItemId}
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => handleOpenReviewSheet(item)}
            >
              {maxReward > 0
                ? `${physicalReviewItems.length > 1 ? `${item.nameSnap} ` : ""}후기 작성 (+최대 ${maxReward.toLocaleString("ko-KR")}P)`
                : "상품 후기 작성"}
            </AppButton>
          ),
        )}
      </div>
    );
  }

  if (status === "CANCEL_REQUESTED" || status === "RETURN_REQUESTED") {
    return (
      <div className="mt-3">
        <AppButton variant="secondary" size="sm" fullWidth loading={pending} onClick={handleWithdraw}>
          {pending ? "처리 중..." : "신청 철회"}
        </AppButton>
      </div>
    );
  }

  return null;
}
