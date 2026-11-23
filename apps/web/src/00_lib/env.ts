import "server-only";
import { z } from "zod";

/**
 * GM-011 Strict .env Validation (코드 기본값 Fallback 0%, Fail-Fast)
 * 인프라·세션 상수는 오직 루트 .env에서만 읽으며 누락/형식 오류 시 즉시 중단한다.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WWW_DOMAIN_HOST: z.string().min(1, "WWW_DOMAIN_HOST is required"),
  APP_SUBDOMAIN_HOST: z.string().min(1, "APP_SUBDOMAIN_HOST is required"),
  ADMIN_SUBDOMAIN_HOST: z.string().min(1, "ADMIN_SUBDOMAIN_HOST is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars"),
  APP_COOKIE_MAX_AGE_DAYS: z.coerce.number().int().positive(),
  ADMIN_SESSION_IDLE_MINUTES: z.coerce.number().int().positive(),
  ADMIN_OTP_EXPIRES_MINUTES: z.coerce.number().int().positive(),
  AUTH_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  UPLOAD_PUBLIC_BASE_URL: z.string().min(1).default("/api/uploads"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`[CONFIG_MISSING] Invalid server environment: ${missing}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
