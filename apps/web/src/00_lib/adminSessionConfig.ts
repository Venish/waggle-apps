import "server-only";
import { getServerEnv } from "./env";

export const ADMIN_SESSION_COOKIE_NAME = "WAGGLE_ADMIN_SESSION";
export const ADMIN_OTP_COOKIE_NAME = "WAGGLE_ADMIN_OTP";

export function getAdminSessionPolicy() {
  const env = getServerEnv();
  return {
    sessionCookieName: ADMIN_SESSION_COOKIE_NAME,
    otpCookieName: ADMIN_OTP_COOKIE_NAME,
    cookiePath: "/admin",
    singleSession: true as const,
    idleMs: env.ADMIN_SESSION_IDLE_MINUTES * 60 * 1000,
    otpExpiresMs: env.ADMIN_OTP_EXPIRES_MINUTES * 60 * 1000,
    maxLoginAttempts: env.AUTH_MAX_LOGIN_ATTEMPTS,
  };
}
