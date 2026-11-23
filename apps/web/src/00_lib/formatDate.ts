/**
 * UI 표시용 날짜 포맷터 (YYYY.MM.DD / YYYY.MM.DD HH:mm / YYYY.MM.DD HH:mm:ss)
 * - DB·URL·Input 내부값(ISO YYYY-MM-DD)은 유지하고, 화면 표시 문자열만 점(.) 구분자로 통일한다.
 */
export function formatDateDot(value: Date | string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  const raw = typeof value === "string" ? value : value.toISOString();
  return raw.slice(0, 10).replaceAll("-", ".");
}

export function formatDateTimeDot(
  value: Date | string | null | undefined,
  options?: { seconds?: boolean; fallback?: string },
): string {
  const fallback = options?.fallback ?? "-";
  if (!value) return fallback;
  const iso = typeof value === "string" ? value : value.toISOString();
  const len = options?.seconds ? 19 : 16;
  const [datePart, timePart] = iso.slice(0, len).split("T");
  const formattedDate = (datePart ?? "").replaceAll("-", ".");
  return timePart ? `${formattedDate} ${timePart}` : formattedDate;
}
