import { redirect } from "next/navigation";

export default async function RecordBadgesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string }>;
}) {
  const { dogId } = await searchParams;
  const qs = dogId ? `?tab=badges&dogId=${encodeURIComponent(dogId)}` : "?tab=badges";
  redirect(`/app/record${qs}`);
}
