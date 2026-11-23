import { Pill, Stethoscope, StickyNote, Toilet, Utensils } from "lucide-react";
import { cn, PawIcon } from "@repo/ui";

/**
 * 일상 스티커 6종 라인 아이콘 (lucide-react + PawIcon, 카테고리별 시맨틱 컬러)
 */
export function DailyStickerIcon({
  kind,
  className = "size-4",
}: {
  kind: string;
  className?: string;
}) {
  switch (kind) {
    case "POOP":
      return <Toilet className={cn("shrink-0 text-amber-700", className)} strokeWidth={2} />;
    case "MEAL":
      return <Utensils className={cn("shrink-0 text-orange-500", className)} strokeWidth={2} />;
    case "MEDICINE":
      return <Pill className={cn("shrink-0 text-sky-500", className)} strokeWidth={2} />;
    case "HOSPITAL":
      return <Stethoscope className={cn("shrink-0 text-rose-500", className)} strokeWidth={2} />;
    case "WALK":
      return <PawIcon className={cn("shrink-0 text-brand", className)} />;
    default:
      return <StickyNote className={cn("shrink-0 text-amber-500", className)} strokeWidth={2} />;
  }
}
