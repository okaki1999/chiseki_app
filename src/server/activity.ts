import { type Prisma } from "@prisma/client";
import { type AppSession } from "~/server/auth";
import { db } from "~/server/db";

type ActivityInput = {
  session: AppSession;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  usage?: boolean;
};

export async function recordActivity({
  session,
  action,
  targetType,
  targetId,
  metadata,
  usage = false,
}: ActivityInput) {
  const common = {
    tenantId: session.tenant.id,
    userId: session.user.id,
    action,
    metadata,
  };

  await db.auditLog
    .create({
      data: {
        ...common,
        targetType,
        targetId,
      },
    })
    .catch((error) => {
      console.error("Audit log failed", error);
    });

  if (usage) {
    await db.usageEvent
      .create({
        data: common,
      })
      .catch((error) => {
        console.error("Usage event failed", error);
      });
  }
}
