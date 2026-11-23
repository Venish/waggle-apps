import type { Metadata, Viewport } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

export const WEB_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

/**
 * (www) · (mobile) 공용 SEO / Favicon / Manifest / OpenGraph 메타데이터 생성기
 * - /favicon.ico, /apple-touch-icon.png, /favicon-32x32.png, /favicon-16x16.png, /site.webmanifest, /images/og.png
 */
export function buildWebMetadata({
  title,
  description,
  urlPath = "/",
}: {
  title: string;
  description: string;
  urlPath?: string;
}): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: "와글(Waggle)",
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    appleWebApp: {
      capable: true,
      title: "와글",
      statusBarStyle: "default",
    },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "와글(Waggle)",
      title,
      description,
      url: urlPath,
      images: [
        {
          url: "/images/og.png",
          width: 1200,
          height: 630,
          alt: "와글(Waggle) — 반려견 맞춤 교육 & 데일리 기록",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/og.png"],
    },
  };
}
