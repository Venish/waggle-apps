import { requireAdminSession } from "@/00_lib/session";
import { createAdminAccountAction } from "@/03_actions/admin/adminAuthActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  adminButtonClass,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/AdminUiKit";

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
          <AdminInput name="email" type="email" size="md" className="mt-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">이름 *</label>
          <AdminInput name="name" type="text" size="md" className="mt-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">휴대폰 번호 (SMS 2FA 수신) *</label>
          <AdminInput name="phone" type="text" size="md" placeholder="010-0000-0000" className="mt-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">역할</label>
          <AdminSelect
            name="role"
            defaultValue="ADMIN"
            ariaLabel="역할"
            size="md"
            className="mt-1"
            options={[
              { value: "ADMIN", label: "ADMIN (전체 운영 콘솔)" },
              { value: "TRAINER", label: "TRAINER (훈련사 제한 포털)" },
            ]}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">초기 비밀번호 (8자 이상) *</label>
          <AdminInput name="password" type="password" size="md" className="mt-1" />
        </div>
        <button type="submit" className={adminButtonClass({ variant: "solid", size: "md" })}>
          계정 생성
        </button>
      </AdminActionForm>
    </div>
  );
}
