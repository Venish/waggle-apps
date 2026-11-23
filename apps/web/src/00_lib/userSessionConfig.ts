import "server-only";
import { getServerEnv } from "./env";

export const USER_SESSION_COOKIE_NAME = "WAGGLE_APP_SESSION";

export function getUserSessionPolicy() {
  const env = getServerEnv();
  return {
    cookieName: USER_SESSION_COOKIE_NAME,
    cookiePath: "/",
    singleSession: true as const,
    idleMs: null as null,
    absoluteMs: null as null,
    cookieMaxAgeSeconds: env.APP_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
    maxLoginAttempts: env.AUTH_MAX_LOGIN_ATTEMPTS,
  };
}
