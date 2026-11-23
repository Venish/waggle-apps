import { notFound } from "next/navigation";
import {
  and,
  asc,
  dailyEntries,
  dailyEntryStickers,
  desc,
  dogs,
  eq,
  getDb,
} from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { DailyEditorClient } from "@/components/web/DailyEditorClient";
import { EmptyStateCard, SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d;
}

export default async function DailyDatePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ dogId?: string }>;
}) {
  const session = await requireUserSession();
  const [{ date }, { dogId: queryDogId }] = await Promise.all([params, searchParams]);
  if (!isValidYmd(date)) {
    notFound();
  }
  const db = getDb();

  const myDogs = await db
    .select()
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(desc(dogs.isPrimary), asc(dogs.id));

  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0];
  const requestedDogId = queryDogId ? Number(queryDogId) : NaN;
  const dog = myDogs.find((d) => d.id === requestedDogId) ?? primaryDog;

  if (!dog) {
    return (
      <EmptyStateCard
        title="등록된 반려견이 없습니다"
        description="반려견을 먼저 등록해 주세요."
        ctaLabel="반려견 등록"
        ctaHref="/app/onboarding/profile"
      />
    );
  }

  const [entry] = await db
    .select()
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.dogId, dog.id),
        eq(dailyEntries.entryDate, date),
        eq(dailyEntries.isDeleted, false),
      ),
    )
    .limit(1);

  const stickers = entry
    ? await db
        .select()
        .from(dailyEntryStickers)
        .where(
          and(eq(dailyEntryStickers.entryId, entry.id), eq(dailyEntryStickers.isDeleted, false)),
        )
    : [];

  return (
    <div className="space-y-4 pb-10">
      <SubPageHeader
        title={myDogs.length > 1 ? `${formatDateDot(date)} · ${dog.name}` : `${formatDateDot(date)} 기록`}
        backHref={`/app/daily?dogId=${dog.id}`}
      />

      <DailyEditorClient
        dogId={dog.id}
        entryDate={date}
        initialEntry={
          entry
            ? {
                id: entry.id,
                walked: entry.walked,
                weightKg: entry.weightKg,
                photoUrls: Array.isArray(entry.photoUrls) ? entry.photoUrls : [],
                memo: entry.memo,
                stickers: stickers.map((s) => ({
                  id: s.id,
                  kind: s.kind,
                  note: s.note,
                  photoUrl: s.photoUrl,
                })),
              }
            : null
        }
        latestWeightKg={dog.weightKg}
        redirectAfterComplete={`/app/daily?dogId=${dog.id}`}
      />
    </div>
  );
}
