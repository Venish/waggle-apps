import { eq, getDb, users } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { MySettingsClient } from "@/components/web/MySettingsClient";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function MySettingsPage() {
  const session = await requireUserSession();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  return (
    <div className="space-y-4">
      <SubPageHeader title="계정 설정" backHref="/app/my" />
      <MySettingsClient
        initialNickname={user?.nickname ?? session.nickname}
        initialRegion={user?.region ?? ""}
        initialPushOptIn={user?.pushOptIn ?? true}
        initialEducationPushOptIn={user?.educationPushOptIn ?? true}
        initialMarketingOptIn={user?.marketingOptIn ?? false}
      />
    </div>
  );
}
