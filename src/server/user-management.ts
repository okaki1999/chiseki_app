import { TRPCError } from "@trpc/server";
import { type AppRole, type PrismaClient } from "@prisma/client";
import { getSupabase } from "~/lib/supabase";

type UserInput = {
  email: string;
  password?: string;
  name?: string | null;
  usageLimit?: number | null;
};

const tenantUsageLimitMessage =
  "テナントの実行回数を超えないようにユーザーへ割り振ってください";

export async function assertTenantUsageAllocation(
  db: PrismaClient,
  input: {
    tenantId: string;
    nextUsageLimit: number | null;
    memberId?: string;
    userId?: string;
  },
) {
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    include: {
      members: {
        include: {
          user: {
            select: {
              usageLimit: true,
            },
          },
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
  if (tenant.usageLimit === null) return;
  if (input.nextUsageLimit === null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "テナントに上限がある場合、ユーザーの残回数は無制限にできません",
    });
  }

  const replacedMemberId =
    input.memberId ??
    tenant.members.find((member) => member.userId === input.userId)?.id;
  let includesTarget = false;
  let allocated = 0;

  for (const member of tenant.members) {
    const usageLimit =
      member.id === replacedMemberId
        ? input.nextUsageLimit
        : member.user.usageLimit;
    includesTarget ||= member.id === replacedMemberId;

    if (usageLimit === null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "テナントに上限がある場合、所属ユーザーの残回数はすべて数値にしてください",
      });
    }
    allocated += usageLimit;
  }

  if (!includesTarget) {
    allocated += input.nextUsageLimit;
  }

  if (allocated > tenant.usageLimit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: tenantUsageLimitMessage,
    });
  }
}

export async function assertTenantLimitCanCoverAllocation(
  db: PrismaClient,
  input: {
    tenantId: string;
    nextTenantUsageLimit: number | null;
  },
) {
  if (input.nextTenantUsageLimit === null) return;

  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    include: {
      members: {
        include: {
          user: {
            select: {
              usageLimit: true,
            },
          },
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

  let allocated = 0;
  for (const member of tenant.members) {
    if (member.user.usageLimit === null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "テナントに上限を設定する前に、所属ユーザーの残回数をすべて数値にしてください",
      });
    }
    allocated += member.user.usageLimit;
  }

  if (allocated > input.nextTenantUsageLimit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: tenantUsageLimitMessage,
    });
  }
}

export async function createAuthBackedUser(
  db: PrismaClient,
  input: Required<Pick<UserInput, "email" | "password">> &
    Pick<UserInput, "name" | "usageLimit">,
) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.usageLimit !== undefined && { usageLimit: input.usageLimit }),
      },
    });
  }

  const { data, error } = await getSupabase().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name ?? null },
  });

  if (error || !data.user.email) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error?.message ?? "ユーザー作成に失敗しました",
    });
  }

  return db.user.create({
    data: {
      supabaseUserId: data.user.id,
      email: data.user.email,
      name: input.name ?? null,
      usageLimit: input.usageLimit ?? null,
    },
  });
}

export async function updateAuthBackedUser(
  db: PrismaClient,
  userId: string,
  input: UserInput,
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "ユーザーが見つかりません",
    });
  }

  const { error } = await getSupabase().auth.admin.updateUserById(
    user.supabaseUserId,
    {
      ...(input.email && { email: input.email }),
      ...(input.password && { password: input.password }),
      ...(input.name !== undefined && {
        user_metadata: { name: input.name ?? null },
      }),
      email_confirm: true,
    },
  );

  if (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  return db.user.update({
    where: { id: userId },
    data: {
      ...(input.email && { email: input.email }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.usageLimit !== undefined && { usageLimit: input.usageLimit }),
    },
  });
}

export async function attachUserToTenant(
  db: PrismaClient,
  tenantId: string,
  userId: string,
  role: AppRole,
) {
  return db.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
    update: { role },
    create: {
      tenantId,
      userId,
      role,
    },
    include: { user: true },
  });
}
