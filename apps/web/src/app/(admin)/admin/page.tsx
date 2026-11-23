import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "@/00_lib/session";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");
  redirect(session.role === "TRAINER" ? "/admin/trainer" : "/admin/dashboard");
}
