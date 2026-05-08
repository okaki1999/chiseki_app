import { TRPCError } from "@trpc/server";
import { type AppRole } from "@prisma/client";
import { z } from "zod";
import { isSuperAdmin } from "~/server/auth";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const requireSuperAdmin = (role: AppRole) => {
  if (!isSuperAdmin(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "全管理者権限がありません",
    });
  }
};

export const adminRouter = createTRPCRouter({
  overview: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.session.role);

    const [tenants, usersCount, usageByAction, recentAuditLogs] =
      await Promise.all([
        ctx.db.tenant.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                members: true,
                surveyMaps: true,
                usageEvents: true,
              },
            },
          },
        }),
        ctx.db.user.count(),
        ctx.db.usageEvent.groupBy({
          by: ["action"],
          _count: { _all: true },
          orderBy: { action: "asc" },
        }),
        ctx.db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            tenant: true,
            user: true,
          },
        }),
      ]);

    return {
      tenants,
      usersCount,
      usageByAction,
      recentAuditLogs,
    };
  }),

  auditLogs: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        take: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      return ctx.db.auditLog.findMany({
        where: input.tenantId ? { tenantId: input.tenantId } : undefined,
        orderBy: { createdAt: "desc" },
        take: input.take,
        include: {
          tenant: true,
          user: true,
        },
      });
    }),
});
