import { asc, eq, getDb, notificationTemplates } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminSendNotificationAction,
  adminUpdateTemplateAction,
} from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.isDeleted, false))
    .orderBy(asc(notificationTemplates.code));

  async function sendManual(formData: FormData) {
    "use server";
    const target = String(formData.get("targetUserId") ?? "").trim();
    return adminSendNotificationAction({
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      deepLink: String(formData.get("deepLink") ?? "/app/my/notifications"),
      targetUserId: target ? Number(target) : null,
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="알림 템플릿 & 수동 발송"
        description="보호자 알림함 적재 + FCM Mock 어댑터 발송"
      />

      <AdminActionForm
        action={sendManual}
        errorTitle="알림 발송 실패"
        successMessage="알림이 발송되었습니다."
        resetOnSuccess
        className="grid gap-2 rounded-panel bg-base-2 p-4 sm:grid-cols-2 atlas-border"
      >
        <h3 className="sm:col-span-2 text-sm font-semibold">수동 알림 발송</h3>
        <input name="title" placeholder="알림 제목" className="h-7 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <input name="targetUserId" placeholder="특정 회원 ID (비우면 전체 발송)" className="h-7 rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <input name="body" placeholder="알림 본문" className="h-7 sm:col-span-2 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <input name="deepLink" defaultValue="/app" placeholder="딥링크 URL" className="h-7 rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          즉시 발송
        </button>
      </AdminActionForm>

      <div className="space-y-2.5">
        {templates.map((tpl) => {
          async function updateTpl(formData: FormData) {
            "use server";
            return adminUpdateTemplateAction({
              id: tpl.id,
              title: String(formData.get("title") ?? tpl.title),
              body: String(formData.get("body") ?? tpl.body),
            });
          }
          return (
            <AdminActionForm
              key={tpl.id}
              action={updateTpl}
              errorTitle="템플릿 저장 실패"
              successMessage={`${tpl.code} 템플릿이 저장되었습니다.`}
              className="rounded-panel bg-base-1 p-4 space-y-2 atlas-border"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-info">{tpl.code}</span>
                <button type="submit" className="h-6 rounded-btn-sm bg-inverse px-2 text-xs text-on-inverse">
                  템플릿 저장
                </button>
              </div>
              <input name="title" defaultValue={tpl.title} className="h-7 w-full rounded-control bg-base-2 px-2.5 text-xs atlas-border" />
              <input name="body" defaultValue={tpl.body} className="h-7 w-full rounded-control bg-base-2 px-2.5 text-xs atlas-border" />
            </AdminActionForm>
          );
        })}
      </div>
    </div>
  );
}
