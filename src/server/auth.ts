import { TRPCError } from "@trpc/server";
import { type AppRole, type PrismaClient } from "@prisma/client";
import { getSupabase } from "~/lib/supabase";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
};

export type AppSession = {
  user: {
    id: string;
    supabaseUserId: string;
    email: string;
    name: string | null;
  };
  tenant: {
    id: string;
    name: string;
  };
  role: AppRole;
};

export const canWriteSurveyMap = (role: AppRole) =>
  role === "SUPER_ADMIN" || role === "TENANT_ADMIN" || role === "MEMBER";

export const canDeleteSurveyMap = (role: AppRole) =>
  role === "SUPER_ADMIN" || role === "TENANT_ADMIN";

export const canManageTenant = (role: AppRole) =>
  role === "SUPER_ADMIN" || role === "TENANT_ADMIN";

export const isSuperAdmin = (role: AppRole) => role === "SUPER_ADMIN";

const extractBearerToken = (headers: Headers) => {
  const authorization = headers.get("authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  return match?.[1];
};

export async function resolveAppSession(
  db: PrismaClient,
  headers: Headers,
): Promise<AppSession | null> {
  const token = extractBearerToken(headers);
  if (!token) return null;

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data.user?.email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ログインしてください",
    });
  }

  const authUser = data.user as AuthUser;
  const email = authUser.email;
  if (!email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "メールアドレスを確認できません",
    });
  }
  const tenantName = email.split("@")[0]
    ? `${email.split("@")[0]} のテナント`
    : "Default Tenant";
  const name =
    authUser.user_metadata?.name ?? authUser.user_metadata?.full_name ?? null;
  const existingUser = await db.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
  const appUser = existingUser
    ? existingUser.email !== email || existingUser.name !== name
      ? await db.user.update({
          where: { id: existingUser.id },
          data: { email, name },
        })
      : existingUser
    : await db.user.create({
        data: {
          supabaseUserId: authUser.id,
          email,
          name,
        },
      });

  const firstUserRole: AppRole = existingUser
    ? "TENANT_ADMIN"
    : (await db.user.count()) === 1
      ? "SUPER_ADMIN"
      : "TENANT_ADMIN";

  const membership = await db.tenantMember.findFirst({
    where: { userId: appUser.id },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    return {
      user: appUser,
      tenant: membership.tenant,
      role: membership.role,
    };
  }

  const tenant = await db.tenant.create({
    data: {
      name: tenantName,
      members: {
        create: {
          userId: appUser.id,
          role: firstUserRole,
        },
      },
    },
  });

  await db.surveyMap.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });

  return {
    user: appUser,
    tenant,
    role: firstUserRole,
  };
}
