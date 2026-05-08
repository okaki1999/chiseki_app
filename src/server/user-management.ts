import { TRPCError } from "@trpc/server";
import { type AppRole, type PrismaClient } from "@prisma/client";
import { getSupabase } from "~/lib/supabase";

type UserInput = {
  email: string;
  password?: string;
  name?: string | null;
};

export async function createAuthBackedUser(
  db: PrismaClient,
  input: Required<Pick<UserInput, "email" | "password">> &
    Pick<UserInput, "name">,
) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) return existing;

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
