import "server-only";
import crypto from "node:crypto";

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(plain, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(digits, "0");
}
