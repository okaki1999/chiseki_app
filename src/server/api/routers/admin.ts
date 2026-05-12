import { TRPCError } from "@trpc/server";
import { type AppRole } from "@prisma/client";
import { z } from "zod";
import { isSuperAdmin } from "~/server/auth";
import { recordActivity } from "~/server/activity";
import {
  attachUserToTenant,
  createAuthBackedUser,
  updateAuthBackedUser,
} from "~/server/user-management";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const requireSuperAdmin = (role: AppRole) => {
  if (!isSuperAdmin(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "全管理者権限がありません",
    });
  }
};

const adminRoleSchema = z.enum([
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "MEMBER",
  "VIEWER",
]);
const usageLimitSchema = z.number().int().min(0).nullable().optional();

export const adminRouter = createTRPCRouter({
  overview: protectedProcedure.query(async ({ ctx }) => {
    requireSuperAdmin(ctx.session.role);

    const [tenants, usersCount, usageByAction, recentAuditLogs] =
      await Promise.all([
        ctx.db.tenant.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            members: {
              include: { user: true },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            },
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

  createTenant: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      const tenant = await ctx.db.tenant.create({
        data: { name: input.name },
      });

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_create",
        targetType: "tenant",
        targetId: tenant.id,
        metadata: { name: tenant.name },
      });

      return tenant;
    }),

  updateTenant: protectedProcedure
    .input(z.object({ tenantId: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      const tenant = await ctx.db.tenant.update({
        where: { id: input.tenantId },
        data: { name: input.name },
      });

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_update",
        targetType: "tenant",
        targetId: tenant.id,
        metadata: { name: tenant.name },
      });

      return tenant;
    }),

  deleteTenant: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      if (input.tenantId === ctx.session.tenant.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分が所属中のテナントは削除できません",
        });
      }

      const tenant = await ctx.db.tenant.findUnique({
        where: { id: input.tenantId },
      });
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "テナントが見つかりません",
        });
      }

      await ctx.db.tenant.delete({ where: { id: input.tenantId } });

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_delete",
        targetType: "tenant",
        targetId: tenant.id,
        metadata: { name: tenant.name },
      });

      return { ok: true };
    }),

  createTenantMember: protectedProcedure
    .input(
      z.object({
        tenantId: z.string(),
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().max(80).optional(),
        usageLimit: usageLimitSchema,
        role: adminRoleSchema.default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      const user = await createAuthBackedUser(ctx.db, {
        email: input.email,
        password: input.password,
        name: input.name ?? null,
        usageLimit: input.usageLimit ?? null,
      });
      const member = await attachUserToTenant(
        ctx.db,
        input.tenantId,
        user.id,
        input.role,
      );

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_member_create",
        targetType: "user",
        targetId: user.id,
        metadata: {
          tenantId: input.tenantId,
          email: user.email,
          role: input.role,
          usageLimit: input.usageLimit ?? null,
        },
      });

      return member;
    }),

  updateTenantMember: protectedProcedure
    .input(
      z.object({
        memberId: z.string(),
        email: z.string().email(),
        password: z.string().min(8).optional().or(z.literal("")),
        name: z.string().max(80).optional(),
        usageLimit: usageLimitSchema,
        role: adminRoleSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      const member = await ctx.db.tenantMember.findUnique({
        where: { id: input.memberId },
        include: { user: true },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "メンバーが見つかりません",
        });
      }

      const user = await updateAuthBackedUser(ctx.db, member.userId, {
        email: input.email,
        password: input.password === "" ? undefined : input.password,
        name: input.name ?? null,
        usageLimit: input.usageLimit ?? null,
      });
      const updated = await ctx.db.tenantMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
        include: { user: true },
      });

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_member_update",
        targetType: "user",
        targetId: member.userId,
        metadata: {
          tenantId: member.tenantId,
          beforeEmail: member.user.email,
          afterEmail: user.email,
          beforeRole: member.role,
          afterRole: input.role,
          afterUsageLimit: input.usageLimit ?? null,
          passwordChanged: Boolean(input.password),
        },
      });

      return updated;
    }),

  removeTenantMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperAdmin(ctx.session.role);

      const member = await ctx.db.tenantMember.findUnique({
        where: { id: input.memberId },
        include: { user: true },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "メンバーが見つかりません",
        });
      }
      if (member.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身は削除できません",
        });
      }

      await ctx.db.tenantMember.delete({ where: { id: input.memberId } });

      await recordActivity({
        session: ctx.session,
        action: "admin.tenant_member_remove",
        targetType: "user",
        targetId: member.userId,
        metadata: {
          tenantId: member.tenantId,
          email: member.user.email,
          role: member.role,
        },
      });

      return { ok: true };
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
