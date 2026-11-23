export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "REFERENCE_BLOCKED"
  | "INSUFFICIENT_POINTS"
  | "BALANCE_STALE"
  | "CONFIG_MISSING"
  | "INTERNAL_ERROR";

export interface AppError {
  code: AppErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  latestBalance?: number;
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: AppErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
  extra?: { latestBalance?: number },
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(extra?.latestBalance !== undefined ? { latestBalance: extra.latestBalance } : {}),
    },
  };
}
