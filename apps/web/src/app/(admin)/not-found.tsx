import { AdminStatusView } from "@/components/admin/AdminStatusView";

export default function AdminNotFoundPage() {
  return (
    <AdminStatusView
      code="404"
      title="페이지를 찾을 수 없습니다"
      description="요청한 운영 콘솔 경로가 존재하지 않거나 이동되었습니다."
      primaryAction={{ label: "대시보드로 이동", href: "/admin/dashboard" }}
    />
  );
}
