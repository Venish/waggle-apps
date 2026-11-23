import crypto from "node:crypto";

// 혼동 문자(0/o/1/l/i)를 제외한 소문자 영숫자 31종 → 6자리 약 8.8억 조합
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 6;

export function generateDefaultNickname(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `waggle_${code}`;
}

export function resolveUserNickname(raw?: string | null): string {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : generateDefaultNickname();
}
