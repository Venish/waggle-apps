import { redirect } from "next/navigation";

export default function RootLoginRedirectPage() {
  redirect("/app/onboarding/login");
}
