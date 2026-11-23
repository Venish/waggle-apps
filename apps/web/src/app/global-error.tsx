"use client";

import { useEffect } from "react";
import { WaggleMark } from "@repo/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] fatal root error:", error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          color: "#111827",
          fontFamily:
            'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "24px",
            backgroundColor: "#f3f4f6",
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
            boxSizing: "border-box",
          }}
        >
          <WaggleMark />
        </div>

        <p
          style={{
            marginTop: "24px",
            marginBottom: 0,
            fontSize: "14px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "#6b7280",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          500
        </p>

        <h1
          style={{
            marginTop: "8px",
            marginBottom: 0,
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          잠시 문제가 생겼어요
        </h1>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            maxWidth: "280px",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#6b7280",
          }}
        >
          시스템에 일시적인 오류가 발생했습니다. 다시 시도해 주세요.
        </p>

        <div
          style={{
            marginTop: "32px",
            width: "100%",
            maxWidth: "260px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              height: "48px",
              width: "100%",
              border: "none",
              borderRadius: "16px",
              backgroundColor: "#00c896",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          <a
            href="/"
            style={{
              height: "48px",
              width: "100%",
              borderRadius: "16px",
              backgroundColor: "#f3f4f6",
              color: "#111827",
              fontSize: "15px",
              fontWeight: 700,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            홈으로
          </a>
        </div>
      </body>
    </html>
  );
}
