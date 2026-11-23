import { WebStatusView } from "@/components/web/WebStatusView";

export default function MobileNotFoundPage() {
  return (
    <WebStatusView
      code="404"
      title="페이지를 찾을 수 없어요"
      description="요청하신 화면이 없거나 이동되었습니다."
      primaryAction={{ label: "교육 홈으로", href: "/app" }}
    />
  );
}
