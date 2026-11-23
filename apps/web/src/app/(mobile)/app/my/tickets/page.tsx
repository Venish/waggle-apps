import { and, asc, courses, desc, dogs, eq, getDb, userTickets } from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { MyTicketsClient } from "@/components/web/MyTicketsClient";
import type { EffectiveTicketStatus, UserTicketView } from "@/components/web/TicketCard";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  const session = await requireUserSession();
  const db = getDb();

  const [rows, myDogs] = await Promise.all([
    db
      .select({
        id: userTickets.id,
        ticketType: userTickets.ticketType,
        titleSnap: userTickets.titleSnap,
        courseId: userTickets.courseId,
        courseTitle: courses.title,
        status: userTickets.status,
        expiresAt: userTickets.expiresAt,
        usedAt: userTickets.usedAt,
        usedDogId: userTickets.usedDogId,
        createdAt: userTickets.createdAt,
      })
      .from(userTickets)
      .leftJoin(courses, eq(userTickets.courseId, courses.id))
      .where(and(eq(userTickets.userId, session.userId), eq(userTickets.isDeleted, false)))
      .orderBy(desc(userTickets.createdAt), desc(userTickets.id)),
    db
      .select({ id: dogs.id, name: dogs.name, isPrimary: dogs.isPrimary })
      .from(dogs)
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(desc(dogs.isPrimary), asc(dogs.id)),
  ]);

  const dogNameById = new Map(myDogs.map((d) => [d.id, d.name]));
  const nowMs = Date.now();

  const ticketViews: UserTicketView[] = rows.map((row) => {
    let effectiveStatus: EffectiveTicketStatus = row.status;
    if (
      row.status === "AVAILABLE" &&
      row.expiresAt &&
      row.expiresAt.getTime() <= nowMs
    ) {
      effectiveStatus = "EXPIRED";
    }

    return {
      id: row.id,
      ticketType: row.ticketType,
      title: row.titleSnap,
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      effectiveStatus,
      issuedAtText: formatDateDot(row.createdAt),
      usedAtText: row.usedAt ? formatDateDot(row.usedAt) : null,
      expiresAtText: row.expiresAt ? formatDateDot(row.expiresAt) : null,
      usedDogName: row.usedDogId ? (dogNameById.get(row.usedDogId) ?? null) : null,
    };
  });

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="내 티켓 · 이용권" backHref="/app/my" />
      <MyTicketsClient tickets={ticketViews} />
    </div>
  );
}
