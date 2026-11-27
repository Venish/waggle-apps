import { asc, breeds, commonCodes, eq, getDb } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminCreateBreedAction,
  adminCreateCommonCodeAction,
} from "@/03_actions/admin/adminUserCodeActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminSoftDeleteCodeButton } from "@/components/admin/AdminSoftDeleteCodeButton";
import {
  adminButtonClass,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminCodesPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [codes, breedList] = await Promise.all([
    db
      .select()
      .from(commonCodes)
      .where(eq(commonCodes.isDeleted, false))
      .orderBy(asc(commonCodes.codeGroup), asc(commonCodes.sortOrder)),
    db
      .select()
      .from(breeds)
      .where(eq(breeds.isDeleted, false))
      .orderBy(asc(breeds.nameKo)),
  ]);

  async function addCode(formData: FormData) {
    "use server";
    return adminCreateCommonCodeAction({
      codeGroup: String(formData.get("codeGroup") ?? "VACCINE_TYPE"),
      code: String(formData.get("code") ?? ""),
      codeKorName: String(formData.get("codeKorName") ?? ""),
      description: String(formData.get("description") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    });
  }

  async function addBreed(formData: FormData) {
    "use server";
    return adminCreateBreedAction({
      code: String(formData.get("code") ?? ""),
      nameKo: String(formData.get("nameKo") ?? ""),
      nameEn: String(formData.get("nameEn") ?? ""),
      defaultSize: (formData.get("defaultSize") ?? "SMALL") as "SMALL" | "MEDIUM" | "LARGE",
    });
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="공통코드 & 견종 마스터"
        description="참조 중인 코드/견종은 삭제가 원천 차단되며, 허용 삭제 건은 감사로그에서 복원 가능합니다."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Common Codes */}
        <div className="min-w-0 space-y-3">
          <AdminActionForm
            action={addCode}
            errorTitle="공통코드 추가 실패"
            successMessage="공통코드가 추가되었습니다."
            resetOnSuccess
            className="grid grid-cols-1 gap-2 rounded-panel bg-base-2 p-3 sm:grid-cols-2 atlas-border"
          >
            <input name="codeGroup" defaultValue="VACCINE_TYPE" className="h-7 min-w-0 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
            <input name="code" placeholder="코드 (예: FLU)" className="h-7 min-w-0 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
            <input name="codeKorName" placeholder="한글 명칭" className="h-7 min-w-0 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
            <button type="submit" className="h-7 whitespace-nowrap rounded-control bg-inverse px-2.5 text-xs font-medium text-on-inverse">
              공통코드 추가
            </button>
          </AdminActionForm>

          <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
            <table className="w-full min-w-full text-left">
              <thead>
                <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
                  <th className="py-2 pl-4 pr-2 whitespace-nowrap">그룹/코드</th>
                  <th className="px-2 py-2 whitespace-nowrap">명칭</th>
                  <th className="py-2 pl-2 pr-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-xs">
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pl-4 pr-2 font-mono whitespace-nowrap text-secondary">
                      {c.codeGroup}.{c.code}
                    </td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{c.codeKorName}</td>
                    <td className="py-2 pl-2 pr-4 text-right whitespace-nowrap">
                      <AdminSoftDeleteCodeButton kind="code" id={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breeds */}
        <div className="min-w-0 space-y-3">
          <AdminActionForm
            action={addBreed}
            errorTitle="견종 추가 실패"
            successMessage="견종이 추가되었습니다."
            resetOnSuccess
            className="grid grid-cols-1 gap-2 rounded-panel bg-base-2 p-3 sm:grid-cols-2 atlas-border"
          >
            <AdminInput name="code" size="sm" placeholder="견종 코드" />
            <AdminInput name="nameKo" size="sm" placeholder="견종 한글명" />
            <AdminInput name="nameEn" size="sm" placeholder="English Name" />
            <div className="flex gap-1.5">
              <AdminSelect
                name="defaultSize"
                defaultValue="SMALL"
                ariaLabel="견종 크기"
                size="sm"
                className="min-w-0 flex-1"
                options={[
                  { value: "SMALL", label: "SMALL" },
                  { value: "MEDIUM", label: "MEDIUM" },
                  { value: "LARGE", label: "LARGE" },
                ]}
              />
              <button type="submit" className={adminButtonClass({ variant: "solid", size: "md" })}>
                추가
              </button>
            </div>
          </AdminActionForm>

          <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
            <table className="w-full min-w-full text-left">
              <thead>
                <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
                  <th className="py-2 pl-4 pr-2 whitespace-nowrap">코드</th>
                  <th className="px-2 py-2 whitespace-nowrap">견종명</th>
                  <th className="px-2 py-2 whitespace-nowrap">크기</th>
                  <th className="py-2 pl-2 pr-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-xs">
                {breedList.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pl-4 pr-2 font-mono whitespace-nowrap text-secondary">{b.code}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{b.nameKo}</td>
                    <td className="px-2 py-2 font-mono whitespace-nowrap text-subdued">{b.defaultSize}</td>
                    <td className="py-2 pl-2 pr-4 text-right whitespace-nowrap">
                      <AdminSoftDeleteCodeButton kind="breed" id={b.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
