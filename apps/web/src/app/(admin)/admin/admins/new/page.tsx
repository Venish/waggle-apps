import { requireAdminSession } from "@/00_lib/session";
import { createAdminAccountAction } from "@/03_actions/admin/adminAuthActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminAccountNewPage() {
  await requireAdminSession(["ADMIN"]);

  async function handleCreate(formData: FormData) {
    "use server";
    return createAdminAccountAction({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      role: (formData.get("role") === "TRAINER" ? "TRAINER" : "ADMIN") as "ADMIN" | "TRAINER",
      password: String(formData.get("password") ?? ""),
    });
  }

  return (
    <div className="max-w-lg space-y-4">
      <AdminPageHeader title="관리자 계정 신규 등록" description="ADMIN 또는 TRAINER 계정을 생성합니다." />
      <AdminActionForm
        action={handleCreate}
        errorTitle="계정 생성 실패"
        successMessage="관리자 계정이 생성되었습니다."
        redirectTo="/admin/admins"
        className="space-y-3 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <div>
          <label className="block text-xs font-medium text-secondary">이메일 *</label>
          <input name="email" type="email" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">이름 *</label>
          <input name="name" type="text" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">휴대폰 번호 (SMS 2FA 수신) *</label>
          <input name="phone" type="text" placeholder="010-0000-0000" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">역할</label>
          <select name="role" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-control atlas-border">
            <option value="ADMIN">ADMIN (전체 운영 콘솔)</option>
            <option value="TRAINER">TRAINER (훈련사 제한 포털)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">초기 비밀번호 (8자 이상) *</label>
          <input name="password" type="password" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        </div>
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          계정 생성
        </button>
      </AdminActionForm>
    </div>
  );
}
