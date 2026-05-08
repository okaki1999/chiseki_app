import { TRPCError } from "@trpc/server";
import { type AppRole } from "@prisma/client";
import { z } from "zod";
import { canManageTenant } from "~/server/auth";
import { recordActivity } from "~/server/activity";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const roleSchema = z.enum(["TENANT_ADMIN", "MEMBER", "VIEWER"]);

const requireTenantAdmin = (role: AppRole) => {
  if (!canManageTenant(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "テナント管理権限がありません",
    });
  }
};

export const tenantRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.db.tenant.findUnique({
      where: { id: ctx.session.tenant.id },
      include: {
        members: {
          include: { user: true },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            surveyMaps: true,
            usageEvents: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "テナントが見つかりません",
      });
    }

    const usageByAction = await ctx.db.usageEvent.groupBy({
      by: ["action"],
      where: { tenantId: tenant.id },
      _count: { _all: true },
      orderBy: { action: "asc" },
    });

    return {
      tenant,
      role: ctx.session.role,
      currentUserId: ctx.session.user.id,
      usageByAction,
    };
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      requireTenantAdmin(ctx.session.role);

      const tenant = await ctx.db.tenant.update({
        where: { id: ctx.session.tenant.id },
        data: { name: input.name },
      });

      await recordActivity({
        session: ctx.session,
        action: "tenant.update_name",
        targetType: "tenant",
        targetId: tenant.id,
        metadata: { name: input.name },
      });

      return tenant;
    }),

  addMemberByEmail: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: roleSchema.default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireTenantAdmin(ctx.session.role);

      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "このメールアドレスのユーザーはまだ登録されていません",
        });
      }

      const member = await ctx.db.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: ctx.session.tenant.id,
            userId: user.id,
          },
        },
        update: { role: input.role },
        create: {
          tenantId: ctx.session.tenant.id,
          userId: user.id,
          role: input.role,
        },
        include: { user: true },
      });

      await recordActivity({
        session: ctx.session,
        action: "tenant.member_add",
        targetType: "user",
        targetId: user.id,
        metadata: { email: user.email, role: input.role },
      });

      return member;
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({ memberId: z.string(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      requireTenantAdmin(ctx.session.role);

      const member = await ctx.db.tenantMember.findFirst({
        where: {
          id: input.memberId,
          tenantId: ctx.session.tenant.id,
        },
        include: { user: true },
      });
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "メンバーが見つかりません",
        });
      }

      const updated = await ctx.db.tenantMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
        include: { user: true },
      });

      await recordActivity({
        session: ctx.session,
        action: "tenant.member_role_update",
        targetType: "user",
        targetId: member.userId,
        metadata: {
          email: member.user.email,
          before: member.role,
          after: input.role,
        },
      });

      return updated;
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireTenantAdmin(ctx.session.role);

      const member = await ctx.db.tenantMember.findFirst({
        where: {
          id: input.memberId,
          tenantId: ctx.session.tenant.id,
        },
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

      const adminCount = await ctx.db.tenantMember.count({
        where: {
          tenantId: ctx.session.tenant.id,
          role: { in: ["SUPER_ADMIN", "TENANT_ADMIN"] },
        },
      });
      if (
        adminCount <= 1 &&
        (member.role === "SUPER_ADMIN" || member.role === "TENANT_ADMIN")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "最後の管理者は削除できません",
        });
      }

      await ctx.db.tenantMember.delete({ where: { id: input.memberId } });

      await recordActivity({
        session: ctx.session,
        action: "tenant.member_remove",
        targetType: "user",
        targetId: member.userId,
        metadata: { email: member.user.email, role: member.role },
      });

      return { ok: true };
    }),
});
