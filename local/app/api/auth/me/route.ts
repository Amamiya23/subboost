import { getCurrentAdmin, isSetupRequired } from "@local/lib/auth";
import { dbQueryOne } from "@local/lib/db";
import { json } from "@local/lib/http";

export async function GET() {
  const [setupRequired, admin] = await Promise.all([isSetupRequired(), getCurrentAdmin()]);
  const subCount = admin
    ? Number((await dbQueryOne<{ count: number }>("SELECT COUNT(*) as count FROM Subscription WHERE ownerId = ?", admin.id))?.count ?? 0)
    : 0;
  const tplCount = admin
    ? Number((await dbQueryOne<{ count: number }>("SELECT COUNT(*) as count FROM LocalTemplate WHERE ownerId = ?", admin.id))?.count ?? 0)
    : 0;
  const now = new Date().toISOString();
  return json({
    setupRequired,
    authenticated: Boolean(admin),
    user: admin
      ? {
          id: admin.id,
          username: admin.username,
          name: admin.username,
          avatarUrl: null,
          trustLevel: 4,
          aiAssistantEnabled: false,
          isAdmin: false,
          isBanned: false,
          active: true,
          silenced: false,
          saveRequirementSatisfied: true,
          saveRequirementSatisfiedAt: now,
          createdAt: now,
          updatedAt: now,
          accounts: [],
          quota: {
            maxSubscriptions: 9999,
            maxNodesPerSubscription: 10000,
            maxCustomTemplates: 9999,
            maxImportSourcesPerType: 9999,
            canUseSubscriptionLink: true,
          },
          subscriptionCount: subCount,
          templateCount: tplCount,
        }
      : null,
  });
}
