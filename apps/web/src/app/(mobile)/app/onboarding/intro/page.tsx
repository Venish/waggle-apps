import { Award, GraduationCap } from "lucide-react";
import { PointIcon, WaggleMark } from "@repo/ui";
import { PawTrailBackdrop } from "@/components/web/AuthBrandPrimitives";
import { AppLinkButton } from "@/components/web/ui";

export default function OnboardingIntroPage() {
  return (
    <>
      <PawTrailBackdrop animated />

      <div className="relative z-10 flex flex-1 flex-col justify-center">
        <div className="space-y-10">
          <section className="flex flex-col items-center text-center">
            <span className="waggle-squircle flex size-20 items-center justify-center bg-brand text-white shadow-sm">
              <WaggleMark className="w-[56%]" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold leading-tight tracking-tight text-ink">
              하루 5분 맞춤 교육으로
              <br />
              우리 강아지가 달라져요
            </h1>
          </section>

          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {[
              {
                icon: GraduationCap,
                title: "우리 강아지 맞춤 강좌 추천",
              },
              {
                icon: PointIcon,
                title: "영상·실습·퀴즈마다 포인트 적립",
              },
              {
                icon: Award,
                title: "강의 완주로 강아지 학년 & 배지 성장",
              },
            ].map((item) => (
              <li key={item.title} className="flex items-center gap-3 py-3.5">
                <item.icon className="size-5 shrink-0 text-brand" strokeWidth={2} />
                <span className="text-sm font-bold text-ink">{item.title}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2.5">
            <AppLinkButton href="/app/onboarding/signup" variant="primary" size="lg" fullWidth>
              시작하기
            </AppLinkButton>
            <AppLinkButton href="/app/onboarding/login" variant="secondary" size="lg" fullWidth>
              로그인
            </AppLinkButton>
          </div>
        </div>
      </div>
    </>
  );
}
