import { WaggleMark } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import { PawTrailBackdrop } from "@/components/web/AuthBrandPrimitives";
import { AppLinkButton } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function OnboardingSurveyStartPage() {
  await requireUserSession();

  return (
    <>
      <PawTrailBackdrop animated />

      <div className="relative z-10 flex flex-1 flex-col justify-center py-6">
        <div className="space-y-8">
          <section className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-14 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-ink">
              7가지 질문으로
              <br />
              맞춤 강좌를 찾아요
            </h1>
            <p className="mt-2 text-sm text-ink-muted">약 1분이면 우리 강아지에게 맞는 강좌가 추천돼요</p>
          </section>

          <div className="space-y-2.5">
            <AppLinkButton href="/app/onboarding/survey/1" variant="primary" size="lg" fullWidth>
              설문 시작하기
            </AppLinkButton>
            <AppLinkButton href="/app/onboarding/daily-goal" variant="ghost" size="md" fullWidth>
              건너뛰기
            </AppLinkButton>
          </div>
        </div>
      </div>
    </>
  );
}
