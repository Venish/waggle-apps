export type AdminRole = "ADMIN" | "TRAINER";
export type RolloutWave = "W1" | "W2";

export type LucideIconName =
  | "Sparkles"
  | "GraduationCap"
  | "Award"
  | "CalendarDays"
  | "ShoppingBag"
  | "User"
  | "LayoutDashboard"
  | "Users"
  | "BookOpen"
  | "SlidersHorizontal"
  | "MessageSquareText"
  | "UserCheck"
  | "Package"
  | "Truck"
  | "Bell"
  | "Settings2"
  | "Tags"
  | "Shield"
  | "History"
  | "Video"
  | "Receipt"
  | "Coins"
  | "Star";

export interface MobileTabMenuItem {
  code: "U-01" | "U-02" | "U-03" | "U-04" | "U-05";
  label: string;
  icon: LucideIconName;
  href: string;
  wave: RolloutWave;
  accentToken: "edu-sky" | "goal-yellow" | "daily-pink" | "point-coral" | "brand-lime";
}

export interface AdminSidebarMenuItem {
  section: string;
  code: string;
  label: string;
  icon: LucideIconName;
  href: string;
  roles: readonly AdminRole[];
  wave: RolloutWave;
}

export const MENU_REGISTRY = {
  www: {
    code: "W-01",
    label: "와글 소개",
    icon: "Sparkles" as LucideIconName,
    href: "/",
  },
  mobileTabs: [
    {
      code: "U-01",
      label: "교육",
      icon: "GraduationCap",
      href: "/app",
      wave: "W1",
      accentToken: "edu-sky",
    },
    {
      code: "U-02",
      label: "기록",
      icon: "Award",
      href: "/app/record",
      wave: "W1",
      accentToken: "goal-yellow",
    },
    {
      code: "U-03",
      label: "일상",
      icon: "CalendarDays",
      href: "/app/daily",
      wave: "W1",
      accentToken: "daily-pink",
    },
    {
      code: "U-04",
      label: "포인트샵",
      icon: "ShoppingBag",
      href: "/app/shop",
      wave: "W2",
      accentToken: "point-coral",
    },
    {
      code: "U-05",
      label: "마이",
      icon: "User",
      href: "/app/my",
      wave: "W1",
      accentToken: "brand-lime",
    },
  ] satisfies readonly MobileTabMenuItem[],
  adminSidebar: [
    {
      section: "운영 개요",
      code: "A-01",
      label: "대시보드",
      icon: "LayoutDashboard",
      href: "/admin/dashboard",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "회원 · 반려견",
      code: "A-02",
      label: "회원 관리",
      icon: "Users",
      href: "/admin/users",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "교육 · 매칭",
      code: "A-03",
      label: "강좌 · 강의 관리",
      icon: "BookOpen",
      href: "/admin/education",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "교육 · 매칭",
      code: "A-04",
      label: "온보딩 매칭 · 설문",
      icon: "SlidersHorizontal",
      href: "/admin/matching",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "훈련사 · Q&A",
      code: "A-05",
      label: "영상 Q&A 관리",
      icon: "MessageSquareText",
      href: "/admin/inquiries",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "훈련사 · Q&A",
      code: "A-06",
      label: "훈련사 · 월 정산",
      icon: "UserCheck",
      href: "/admin/trainers",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "커머스",
      code: "A-07",
      label: "포인트샵 상품 · 카테고리",
      icon: "Package",
      href: "/admin/products",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "커머스",
      code: "A-08",
      label: "주문 · 배송 관리",
      icon: "Truck",
      href: "/admin/orders",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "커머스",
      code: "A-15",
      label: "상품 후기 관리",
      icon: "Star",
      href: "/admin/reviews",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "커머스",
      code: "A-14",
      label: "포인트 충전 · 환불",
      icon: "Coins",
      href: "/admin/recharges",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "시스템 · 정책",
      code: "A-09",
      label: "알림 템플릿 · 발송",
      icon: "Bell",
      href: "/admin/notifications",
      roles: ["ADMIN"],
      wave: "W2",
    },
    {
      section: "시스템 · 정책",
      code: "A-10",
      label: "정책 · 배너 설정",
      icon: "Settings2",
      href: "/admin/policies",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "시스템 · 정책",
      code: "A-11",
      label: "공통코드 관리",
      icon: "Tags",
      href: "/admin/codes",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "시스템 · 정책",
      code: "A-12",
      label: "관리자 계정",
      icon: "Shield",
      href: "/admin/admins",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "시스템 · 정책",
      code: "A-13",
      label: "감사로그 · 삭제복원",
      icon: "History",
      href: "/admin/audit-logs",
      roles: ["ADMIN"],
      wave: "W1",
    },
    {
      section: "훈련사 포털",
      code: "T-01",
      label: "내 배정 Q&A 답변",
      icon: "Video",
      href: "/admin/trainer",
      roles: ["TRAINER"],
      wave: "W2",
    },
    {
      section: "훈련사 포털",
      code: "T-02",
      label: "내 월 정산 조회",
      icon: "Receipt",
      href: "/admin/trainer/settlements",
      roles: ["TRAINER"],
      wave: "W2",
    },
  ] satisfies readonly AdminSidebarMenuItem[],
} as const;
