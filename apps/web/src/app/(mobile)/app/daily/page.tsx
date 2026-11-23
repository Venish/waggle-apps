import {
  and,
  asc,
  breeds,
  commonCodes,
  dailyEntries,
  dailyEntryStickers,
  desc,
  dogs,
  eq,
  getDb,
  inArray,
  vaccinationRecords,
} from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import {
  DailyCalendarClient,
  type DailyDogOption,
  type DailyEntryView,
  type DailyMainTab,
  type VaccinationView,
} from "@/components/web/DailyCalendarClient";
import { EmptyStateCard } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function DailyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string; tab?: string }>;
}) {
  const session = await requireUserSession();
  const { dogId: queryDogId, tab: queryTab } = await searchParams;
  const db = getDb();

  const myDogs = await db
    .select({
      id: dogs.id,
      name: dogs.name,
      isPrimary: dogs.isPrimary,
      profileImage: dogs.profileImage,
      weightKg: dogs.weightKg,
      breedName: breeds.nameKo,
    })
    .from(dogs)
    .leftJoin(breeds, eq(dogs.breedId, breeds.id))
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(desc(dogs.isPrimary), asc(dogs.id));

  if (myDogs.length === 0) {
    return (
      <EmptyStateCard
        title="먼저 반려견을 등록해 주세요"
        description="데일리 캘린더와 예방접종 기록은 반려견별로 관리됩니다."
        ctaLabel="반려견 등록"
        ctaHref="/app/onboarding/profile"
      />
    );
  }

  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0]!;
  const requestedDogId = queryDogId ? Number(queryDogId) : NaN;
  const initialDog = myDogs.find((d) => d.id === requestedDogId) ?? primaryDog;
  const initialTab: DailyMainTab =
    queryTab === "gallery" || queryTab === "health" ? queryTab : "daily";

  const allDogIds = myDogs.map((d) => d.id);
  const todayStr = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

  const [entries, vaccines, vaccineCodes] = await Promise.all([
    db
      .select()
      .from(dailyEntries)
      .where(and(inArray(dailyEntries.dogId, allDogIds), eq(dailyEntries.isDeleted, false))),
    db
      .select({
        id: vaccinationRecords.id,
        dogId: vaccinationRecords.dogId,
        vaccineId: vaccinationRecords.vaccineId,
        vaccineName: commonCodes.codeKorName,
        administeredAt: vaccinationRecords.administeredAt,
        nextDueAt: vaccinationRecords.nextDueAt,
        hospital: vaccinationRecords.hospital,
        memo: vaccinationRecords.memo,
      })
      .from(vaccinationRecords)
      .innerJoin(commonCodes, eq(vaccinationRecords.vaccineId, commonCodes.id))
      .where(
        and(inArray(vaccinationRecords.dogId, allDogIds), eq(vaccinationRecords.isDeleted, false)),
      )
      .orderBy(desc(vaccinationRecords.administeredAt)),
    db
      .select({ id: commonCodes.id, name: commonCodes.codeKorName })
      .from(commonCodes)
      .where(
        and(
          eq(commonCodes.codeGroup, "VACCINE_TYPE"),
          eq(commonCodes.isActive, true),
          eq(commonCodes.isDeleted, false),
        ),
      )
      .orderBy(asc(commonCodes.sortOrder)),
  ]);

  const entryIds = entries.map((e) => e.id);
  const allStickers =
    entryIds.length > 0
      ? await db
          .select()
          .from(dailyEntryStickers)
          .where(
            and(
              inArray(dailyEntryStickers.entryId, entryIds),
              eq(dailyEntryStickers.isDeleted, false),
            ),
          )
      : [];

  const stickerMap = new Map<number, DailyEntryView["stickers"]>();
  for (const s of allStickers) {
    const arr = stickerMap.get(s.entryId) ?? [];
    arr.push({ id: s.id, kind: s.kind, note: s.note, photoUrl: s.photoUrl });
    stickerMap.set(s.entryId, arr);
  }

  const dogOptions: DailyDogOption[] = myDogs.map((d) => ({
    id: d.id,
    name: d.name,
    isPrimary: d.isPrimary,
    profileImage: d.profileImage,
    weightKg: d.weightKg,
    breedName: d.breedName,
  }));

  const entryViews: DailyEntryView[] = entries.map((e) => ({
    id: e.id,
    dogId: e.dogId,
    entryDate: e.entryDate,
    walked: e.walked,
    weightKg: e.weightKg,
    photoUrls: Array.isArray(e.photoUrls) ? e.photoUrls : [],
    memo: e.memo,
    stickers: stickerMap.get(e.id) ?? [],
  }));

  const vaccineViews: VaccinationView[] = vaccines.map((v) => ({
    id: v.id,
    dogId: v.dogId,
    vaccineId: v.vaccineId,
    vaccineName: v.vaccineName,
    administeredAt: v.administeredAt.toISOString().slice(0, 10),
    nextDueAt: v.nextDueAt ? v.nextDueAt.toISOString().slice(0, 10) : null,
    hospital: v.hospital,
    memo: v.memo,
  }));

  return (
    <DailyCalendarClient
      todayStr={todayStr}
      dogs={dogOptions}
      initialDogId={initialDog.id}
      initialTab={initialTab}
      entries={entryViews}
      vaccines={vaccineViews}
      vaccineOptions={vaccineCodes}
    />
  );
}
