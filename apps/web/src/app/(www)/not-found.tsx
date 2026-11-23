import { WebStatusView } from "@/components/web/WebStatusView";

export default function WwwNotFoundPage() {
  return (
    <WebStatusView
      code="404"
      title="페이지를 찾을 수 없어요"
      description="주소가 잘못되었거나 이동된 페이지입니다."
      primaryAction={{ label: "와글 홈으로", href: "/" }}
      secondaryAction={{ label: "와글 앱 시작하기", href: "/app" }}
      fullViewport
    />
  );
}
