"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 0ms 동기 useRef 락 + React pending 상태
 * - React 상태 배칭 전 0~30ms 연타/더블탭을 동기적으로 100% 차단한다.
 */
export function useSubmitLock() {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setPending(true);
    try {
      return await task();
    } finally {
      lockRef.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}

export function createClientRequestKey(prefix: string): string {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${uid}`;
}
