import { asc, banners, eq, getDb, policyConfigs } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminCreateBannerAction,
  adminSoftDeleteBannerAction,
  adminUpdatePolicyAction,
} from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminPoliciesPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [policies, bannerList] = await Promise.all([
    db.select().from(policyConfigs).where(eq(policyConfigs.isDeleted, false)).orderBy(asc(policyConfigs.key)),
    db.select().from(banners).where(eq(banners.isDeleted, false)).orderBy(asc(banners.sortOrder)),
  ]);

  async function addBanner(formData: FormData) {
    "use server";
    return adminCreateBannerAction({
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? ""),
      linkUrl: String(formData.get("linkUrl") ?? "/app?tab=explore"),
      placement: String(formData.get("placement") ?? "HOME") as "HOME" | "SHOP_HOME" | "NOTICE",
      accentToken: "brand-lime",
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="정책 (PolicyConfig) · 배너 설정"
        description="GM-011 단일 원천: 모든 포인트 단가·퀴즈 기준·정산율은 여기 DB에서만 관리되며 변경 이력이 자동 누적됩니다."
      />

      {/* PolicyConfig List */}
      <section className="overflow-hidden rounded-panel bg-base-1 atlas-border">
        <div className="flex h-9 items-center bg-base-2 px-4 text-xs font-medium text-secondary atlas-border-b">
          운영 정책 키 ({policies.length})
        </div>
        <div className="divide-y divide-hairline">
          {policies.map((p) => {
            async function savePolicy(formData: FormData) {
              "use server";
              return adminUpdatePolicyAction({
                id: p.id,
                rawJsonValue: String(formData.get("value") ?? ""),
              });
            }
            return (
              <AdminActionForm
                key={p.id}
                action={savePolicy}
                errorTitle="정책 저장 실패"
                successMessage={`${p.key} 정책 값이 저장되었습니다.`}
                className="grid items-center gap-2 px-4 py-2.5 sm:grid-cols-12"
              >
                <div className="min-w-0 sm:col-span-4">
                  <p className="font-mono text-xs font-semibold text-info break-all">{p.key}</p>
                  <p className="text-xs text-subdued break-words">{p.description}</p>
                </div>
                <div className="min-w-0 sm:col-span-6">
                  <input
                    name="value"
                    defaultValue={JSON.stringify(p.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs atlas-border"
                  />
                </div>
                <div className="sm:col-span-2 sm:text-right">
                  <button type="submit" className="h-7 w-full sm:w-auto whitespace-nowrap rounded-control bg-inverse px-2.5 text-xs font-medium text-on-inverse">
                    저장
                  </button>
                </div>
              </AdminActionForm>
            );
          })}
        </div>
      </section>

      {/* Banners */}
      <section className="space-y-3">
        <AdminActionForm
          action={addBanner}
          errorTitle="배너 추가 실패"
          successMessage="배너가 추가되었습니다."
          resetOnSuccess
          className="grid gap-2 rounded-panel bg-base-2 p-3 sm:grid-cols-4 atlas-border"
        >
          <input name="title" placeholder="배너 제목" className="h-7 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
          <input name="subtitle" placeholder="부제목" className="h-7 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
          <select name="placement" className="h-7 rounded-control bg-base-1 px-2 text-xs atlas-border">
            <option value="HOME">HOME</option>
            <option value="SHOP_HOME">SHOP_HOME</option>
            <option value="NOTICE">NOTICE</option>
          </select>
          <button type="submit" className="h-7 rounded-control bg-inverse px-2.5 text-xs font-medium text-on-inverse">
            배너 추가
          </button>
        </AdminActionForm>

        <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
          <table className="w-full min-w-full text-left">
            <thead>
              <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
                <th className="py-2 pl-4 pr-3">영역</th>
                <th className="px-3 py-2">제목</th>
                <th className="py-2 pl-3 pr-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-xs">
              {bannerList.map((b) => {
                async function removeBanner() {
                  "use server";
                  return adminSoftDeleteBannerAction(b.id);
                }
                return (
                  <tr key={b.id}>
                    <td className="py-2 pl-4 pr-3"><AdminStatusBadge tone="info">{b.placement}</AdminStatusBadge></td>
                    <td className="px-3 py-2 font-medium">{b.title}</td>
                    <td className="py-2 pl-3 pr-4 text-right">
                      <AdminActionForm
                        action={removeBanner}
                        errorTitle="삭제 실패"
                        successMessage="배너가 소프트 삭제되었습니다."
                        className="inline"
                      >
                        <button type="submit" className="h-6 rounded-btn-sm px-2 text-xs text-negative atlas-border">
                          소프트 삭제
                        </button>
                      </AdminActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
