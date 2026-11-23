import {
  and,
  asc,
  breeds,
  count,
  dailyEntries,
  dogs,
  enrollments,
  eq,
  getDb,
  inArray,
  inquiries,
} from "@repo/db";
import { formatDPlus, formatGradeLabel } from "@repo/types";
import { requireUserSession } from "@/00_lib/session";
import { setPrimaryDogAction } from "@/03_actions/web/dogDailyActions";
import {
  AddDogSheetButton,
  DeleteDogButton,
  EditDogSheetButton,
} from "@/components/web/SheetTriggerButtons";
import { DogAvatar, SubPageBottomBar, SubPageHeader } from "@/components/web/WebUiKit";
import { AppBadge, appButtonClass } from "@/components/web/ui";

export const dynamic = "force-dynamic";

const SIZE_LABEL: Record<"SMALL" | "MEDIUM" | "LARGE", string> = {
  SMALL: "소형견",
  MEDIUM: "중형견",
  LARGE: "대형견",
};

export default async function MyDogsPage() {
  const session = await requireUserSession();
  const db = getDb();

  const [myDogs, breedList] = await Promise.all([
    db
      .select()
      .from(dogs)
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(asc(dogs.id)),
    db
      .select({ id: breeds.id, nameKo: breeds.nameKo, defaultSize: breeds.defaultSize })
      .from(breeds)
      .where(eq(breeds.isDeleted, false))
      .orderBy(asc(breeds.nameKo)),
  ]);

  const dogIds = myDogs.map((d) => d.id);
  const [enrollmentRows, dailyRows, activeInquiryRows] =
    dogIds.length > 0
      ? await Promise.all([
          db
            .select({ dogId: enrollments.dogId, total: count() })
            .from(enrollments)
            .where(and(inArray(enrollments.dogId, dogIds), eq(enrollments.isDeleted, false)))
            .groupBy(enrollments.dogId),
          db
            .select({ dogId: dailyEntries.dogId, total: count() })
            .from(dailyEntries)
            .where(and(inArray(dailyEntries.dogId, dogIds), eq(dailyEntries.isDeleted, false)))
            .groupBy(dailyEntries.dogId),
          db
            .select({ dogId: inquiries.dogId, total: count() })
            .from(inquiries)
            .where(
              and(
                inArray(inquiries.dogId, dogIds),
                eq(inquiries.userId, session.userId),
                eq(inquiries.isDeleted, false),
                inArray(inquiries.status, ["PENDING", "ASSIGNED"]),
              ),
            )
            .groupBy(inquiries.dogId),
        ])
      : [[], [], []];

  const enrollmentCountByDog = new Map(enrollmentRows.map((r) => [r.dogId, Number(r.total)]));
  const dailyCountByDog = new Map(dailyRows.map((r) => [r.dogId, Number(r.total)]));
  const activeInquiryCountByDog = new Map(
    activeInquiryRows
      .filter((r): r is { dogId: number; total: number } => r.dogId !== null)
      .map((r) => [r.dogId, Number(r.total)]),
  );

  return (
    <>
      <div className="space-y-6 pb-24">
        <SubPageHeader title="내 반려견 관리" backHref="/app/my" />

        {/* 등록된 반려견 플랫 리스트 */}
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {myDogs.map((d) => {
            async function makePrimary() {
              "use server";
              await setPrimaryDogAction(d.id);
            }

            const hasSecondaryActions = !d.isPrimary || myDogs.length > 1;

            return (
              <li key={d.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <DogAvatar src={d.profileImage} name={d.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-bold text-ink">{d.name}</span>
                        {d.isPrimary && <AppBadge tone="brand">대표견</AppBadge>}
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                        {formatDPlus(d.birthDate)} · {formatGradeLabel(d.grade)} ·{" "}
                        {SIZE_LABEL[d.sizeClass]}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <EditDogSheetButton
                      breeds={breedList}
                      dog={{
                        id: d.id,
                        name: d.name,
                        birthDate: d.birthDate,
                        breedId: d.breedId,
                        sizeClass: d.sizeClass,
                        gender: d.gender,
                        neutered: d.neutered,
                        weightKg: d.weightKg,
                        profileImage: d.profileImage,
                      }}
                    />
                  </div>
                </div>

                {hasSecondaryActions && (
                  <div className="mt-2.5 flex items-center gap-1.5 pl-15">
                    {!d.isPrimary && (
                      <form action={makePrimary}>
                        <button
                          type="submit"
                          className={appButtonClass({ variant: "secondary", size: "xs" })}
                        >
                          대표견 지정
                        </button>
                      </form>
                    )}
                    {myDogs.length > 1 && (
                      <DeleteDogButton
                        dogId={d.id}
                        dogName={d.name}
                        isPrimary={d.isPrimary}
                        enrollmentCount={enrollmentCountByDog.get(d.id) ?? 0}
                        dailyEntryCount={dailyCountByDog.get(d.id) ?? 0}
                        activeInquiryCount={activeInquiryCountByDog.get(d.id) ?? 0}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <SubPageBottomBar>
        <AddDogSheetButton breeds={breedList} label="새 반려견 추가 등록" size="lg" fullWidth />
      </SubPageBottomBar>
    </>
  );
}
