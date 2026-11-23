import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy.ts (3-Domain Host Routing + Admin Production Host Guard)
 * - app.*   -> /app/*   rewrite
 * - admin.* -> /admin/* rewrite
 * - production 환경에서 admin.* 외 호스트의 /admin 직접 접근은 404 차단
 * - Stage 1B(T-SKEL)에서는 세션 쿠키 강제 리다이렉트 없이 라우팅·격리만 검증
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";

  const appHost = process.env.APP_SUBDOMAIN_HOST?.toLowerCase();
  const adminHost = process.env.ADMIN_SUBDOMAIN_HOST?.toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  // 운영 환경에서 비관리자 외부 호스트의 /admin 직접 진입 404 차단 (localhost/127.0.0.1 로컬 검증 허용)
  if (isProd && !isLocalHost && adminHost && host !== adminHost && pathname.startsWith("/admin")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // app.* 서브도메인 리라이트
  if (appHost && host === appHost && !pathname.startsWith("/app") && !pathname.startsWith("/api")) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = pathname === "/" ? "/app" : `/app${pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  // admin.* 서브도메인 리라이트
  if (
    adminHost &&
    host === adminHost &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api")
  ) {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(rewritten);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest|woff2|woff|ttf|otf)$).*)",
  ],
};
