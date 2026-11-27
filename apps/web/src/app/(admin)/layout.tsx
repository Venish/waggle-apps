import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pingDatabase } from "@repo/db";
import "@/styles/admin.css";
import { pretendardFont } from "@/00_lib/fonts";
import { getCurrentAdminSession } from "@/00_lib/session";
import { AdminGlobalAlert } from "@/components/admin/AdminGlobalAlert";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Waggle Admin — Atlas Precision Studio",
  description: "와글(Waggle) 운영 관리자 콘솔 및 훈련사 포털",
};

export const dynamic = "force-dynamic";

async function getAdminDbBadge() {
  try {
    const info = await pingDatabase();
    return {
      connected: true,
      label: `PG18 ${info.database} (${info.latencyMs}ms)`,
    };
  } catch {
    return {
      connected: false,
      label: "PG18 Disconnected",
    };
  }
}

const ADMIN_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem("waggle-admin-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-admin-theme",t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const [dbBadge, session] = await Promise.all([getAdminDbBadge(), getCurrentAdminSession()]);

  return (
    <html
      lang="ko"
      data-admin-theme="dark"
      className={pretendardFont.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-base-1 text-sm text-neutral antialiased">
        <AdminShell
          dbConnected={dbBadge.connected}
          dbLabel={dbBadge.label}
          admin={
            session
              ? { name: session.name, email: session.email, role: session.role }
              : null
          }
        >
          {children}
        </AdminShell>
        <AdminGlobalAlert />
      </body>
    </html>
  );
}
