import { redirect } from "next/navigation";

export default async function CoursesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; dogId?: string }>;
}) {
  const { filter, dogId } = await searchParams;
  const params = new URLSearchParams({ tab: "explore" });
  if (filter === "free" || filter === "premium") {
    params.set("filter", filter);
  }
  if (dogId) {
    params.set("dogId", dogId);
  }
  redirect(`/app?${params.toString()}`);
}
