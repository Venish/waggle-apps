import { asc, breeds, eq, getDb } from "@repo/db";
import { WaggleMark } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import { PawTrailBackdrop } from "@/components/web/AuthBrandPrimitives";
import { DogProfileFormClient } from "@/components/web/DogProfileFormClient";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  await requireUserSession();
  const db = getDb();
  const breedList = await db
    .select({ id: breeds.id, nameKo: breeds.nameKo, defaultSize: breeds.defaultSize })
    .from(breeds)
    .where(eq(breeds.isDeleted, false))
    .orderBy(asc(breeds.nameKo));

  return (
    <>
      <PawTrailBackdrop animated />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="space-y-10">
          <div className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              우리 강아지를 등록해 주세요
            </h1>
          </div>

          <DogProfileFormClient breeds={breedList} hidePhotoUpload />
        </div>
      </div>
    </>
  );
}
