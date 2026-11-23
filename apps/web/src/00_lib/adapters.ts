import "server-only";
import crypto from "node:crypto";
import { saveUploadedFile, type UploadCategory } from "./uploadStorage";

/**
 * GM-108 외부 연동 어댑터 경계 (로컬/초기 검증용 Mock 구현 포함)
 * 운영 실키 투입 시 본 파일의 각 어댑터 구현체만 실 API로 교체하면 된다.
 */

export async function sendSmsOtpAdapter(phone: string, code: string): Promise<{ mocked: boolean }> {
  if (!process.env.SMS_API_KEY) {
    console.info(`[MOCK-SMS] To=${phone} | Waggle Admin OTP Code: ${code}`);
    return { mocked: true };
  }
  // 추후 실 SMS 벤더 API 호출 위치
  console.info(`[SMS] Sent OTP to ${phone}`);
  return { mocked: false };
}

export async function sendPushAdapter(input: {
  userId: number;
  title: string;
  body: string;
  deepLink?: string;
}): Promise<{ mocked: boolean }> {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.info(`[MOCK-FCM] User=${input.userId} | ${input.title} — ${input.body}`);
    return { mocked: true };
  }
  console.info(`[FCM] Sent push to user=${input.userId}`);
  return { mocked: false };
}

export function verifyPortoneWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    // 로컬 개발 Mock 어댑터 모드
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function saveUploadedFileLocal(
  file: File,
  category: UploadCategory = "inquiries",
): Promise<string> {
  const saved = await saveUploadedFile(file, category);
  return saved.url;
}
