import { NextResponse, type NextRequest } from "next/server";
import { and, dailyGoals, eq, getDb, notifications, users } from "@repo/db";
import { sendPushAdapter } from "@/00_lib/adapters";
import { getServerEnv } from "@/00_lib/env";

function isAuthorizedCron(request: NextRequest): boolean {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${env.CRON_SECRET}` || secretHeader === env.CRON_SECRET;
}

/** 현재 KST(UTC+9) 요일(0=일~6=토) 및 HH:MM 반환 */
function getCurrentKstParts(now = new Date()): { dow: number; hhmm: string } {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dow = kst.getUTCDay();
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return { dow, hhmm: `${hh}:${mm}` };
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const matchTime = request.nextUrl.searchParams.get("matchTime") === "true";
  const { dow: kstDow, hhmm: kstHhmm } = getCurrentKstParts();

  const db = getDb();
  const candidates = await db
    .select({
      userId: users.id,
      nickname: users.nickname,
      dailyLessonGoal: dailyGoals.dailyLessonGoal,
      reminderTime: dailyGoals.reminderTime,
      reminderDays: dailyGoals.reminderDays,
    })
    .from(dailyGoals)
    .innerJoin(users, eq(dailyGoals.userId, users.id))
    .where(
      and(
        eq(dailyGoals.reminderEnabled, true),
        eq(dailyGoals.isDeleted, false),
        eq(users.status, "ACTIVE"),
        eq(users.educationPushOptIn, true),
        eq(users.isDeleted, false),
      ),
    );

  // KST 요일 반복 조건 (+ matchTime=true 호출 시 시각 일치 조건) 필터링
  const targets = candidates.filter((c) => {
    const days = Array.isArray(c.reminderDays) ? c.reminderDays : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(kstDow)) return false;
    if (matchTime && c.reminderTime && c.reminderTime !== kstHhmm) return false;
    return true;
  });

  for (const t of targets) {
    await db.insert(notifications).values({
      userId: t.userId,
      kind: "DAILY_GOAL_REMINDER",
      title: `${t.nickname}님, 오늘의 목표 ${t.dailyLessonGoal}개 레슨을 시작해 보세요`,
      body: "매일 5분 꾸준한 교육으로 우리 강아지 학년을 올려보세요.",
      deepLink: "/app",
    });
    await sendPushAdapter({
      userId: t.userId,
      title: "오늘의 와글 교육 리마인드",
      body: `오늘 목표 ${t.dailyLessonGoal}개 레슨을 완료해 보세요.`,
      deepLink: "/app",
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      notifiedCount: targets.length,
      kstDow,
      kstHhmm,
      executedAt: new Date().toISOString(),
    },
  });
}
