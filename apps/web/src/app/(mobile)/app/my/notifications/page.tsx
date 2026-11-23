import { desc, eq, getDb, notifications } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import {
  NotificationsListClient,
  type NotificationItemView,
} from "@/components/web/NotificationsListClient";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function MyNotificationsPage() {
  const session = await requireUserSession();
  const db = getDb();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.userId))
    .orderBy(desc(notifications.id))
    .limit(40);

  const items: NotificationItemView[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    deepLink: n.deepLink,
    isRead: n.isRead,
    createdAtLabel: formatDateTimeDot(n.createdAt),
  }));

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="알림함" backHref="/app/my" />
      <NotificationsListClient initialItems={items} />
    </div>
  );
}
