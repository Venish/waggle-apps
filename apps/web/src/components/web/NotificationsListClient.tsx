"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Trash2 } from "lucide-react";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import {
  deleteNotificationAction,
  markNotificationReadAction,
} from "@/03_actions/web/inquiryNoticeActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { EmptyStateCard } from "@/components/web/WebUiKit";

export interface NotificationItemView {
  id: number;
  title: string;
  body: string;
  deepLink: string | null;
  isRead: boolean;
  createdAtLabel: string;
}

export function NotificationsListClient({
  initialItems,
}: {
  initialItems: NotificationItemView[];
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleOpenItem = async (item: NotificationItemView) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x)));
      await markNotificationReadAction(item.id);
      router.refresh();
    }
    if (item.deepLink) {
      router.push(item.deepLink, {
        transitionTypes: getMobileForwardTransitionTypes(item.deepLink),
      });
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    const snapshot = items;
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      const res = await deleteNotificationAction(id);
      if (!res.ok) {
        setItems(snapshot);
        openAlert({ title: "삭제 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) {
    return (
      <EmptyStateCard
        icon={<Bell className="size-5.5" strokeWidth={1.7} />}
        title="도착한 알림이 없습니다"
        description="교육 보상, 답변 완료, 주문 상태 변경 시 여기에 표시됩니다."
      />
    );
  }

  return (
    <ul className="divide-y divide-border-subtle border-y border-border-subtle">
      {items.map((n) => (
        <li
          key={n.id}
          className={`flex items-start justify-between gap-2 py-4 transition-opacity duration-200 ${
            n.isRead ? "opacity-50" : "opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={() => handleOpenItem(n)}
            className="flex min-w-0 flex-1 items-start gap-2.5 text-left transition-opacity active:opacity-70"
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 size-1.5 shrink-0 rounded-full transition-colors ${
                n.isRead ? "bg-ink-muted/30" : "bg-brand"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-bold leading-snug text-ink">
                {n.title}
              </span>
              <span className="mt-0.5 block break-words text-xs leading-relaxed text-ink-muted">
                {n.body}
              </span>
              <span className="mt-1.5 flex items-center gap-2 text-xs tabular-nums text-ink-muted">
                <span>{n.createdAtLabel}</span>
                {n.deepLink && (
                  <span className="font-semibold text-brand-strong">바로가기 →</span>
                )}
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={busyId === n.id}
            onClick={() => handleDelete(n.id)}
            aria-label="알림 삭제"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-destructive active:opacity-70 disabled:opacity-40"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
          </button>
        </li>
      ))}
    </ul>
  );
}
