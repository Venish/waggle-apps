import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_OTP_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from "@/00_lib/adminSessionConfig";
import { USER_SESSION_COOKIE_NAME } from "@/00_lib/userSessionConfig";

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") ?? "app";
  const reason = request.nextUrl.searchParams.get("reason") ?? "expired";

  if (scope === "admin") {
    const res = NextResponse.redirect(
      new URL(`/admin/login?reason=${encodeURIComponent(reason)}`, request.url),
    );
    res.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", { path: "/admin", maxAge: 0 });
    res.cookies.set(ADMIN_OTP_COOKIE_NAME, "", { path: "/admin", maxAge: 0 });
    return res;
  }

  const res = NextResponse.redirect(
    new URL(`/app/onboarding/login?reason=${encodeURIComponent(reason)}`, request.url),
  );
  res.cookies.set(USER_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
