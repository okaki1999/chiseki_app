import fs from "fs/promises";
import path from "path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { canDeleteSurveyMap, canWriteSurveyMap } from "~/server/auth";
import { recordActivity } from "~/server/activity";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { getSupabase } from "~/lib/supabase";
import { STORAGE_BUCKET } from "~/lib/storage";

const isSupabaseConfigured = () =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

async function uploadImage(
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const ext = imageMimeType.split("/")[1] ?? "jpg";
  const filename = `${Date.now()}.${ext}`;
  const buffer = Buffer.from(imageBase64, "base64");

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buffer, { contentType: imageMimeType });
    if (error) throw new Error(`画像アップロード失敗: ${error.message}`);
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename).data
      .publicUrl;
  }

  // ローカルフォールバック: public/uploads/ に保存
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

async function deleteImage(imageUrl: string): Promise<void> {
  if (imageUrl.startsWith("/uploads/")) {
    const filename = imageUrl.split("/").pop();
    if (filename) {
      await fs
        .unlink(path.join(process.cwd(), "public", "uploads", filename))
        .catch(() => undefined);
    }
    return;
  }
  if (isSupabaseConfigured()) {
    const storagePath = getStoragePathFromPublicUrl(imageUrl);
    if (storagePath) {
      await getSupabase().storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
  }
}

function getPublicImageUrl(storagePath: string) {
  return getSupabase().storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    .data.publicUrl;
}

function getStoragePathFromPublicUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export const surveyMapRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z
        .object({
          name: z.string().min(1),
          imageBase64: z.string().optional(),
          imageMimeType: z.string(),
          imageStoragePath: z.string().optional(),
          extractedData: z.unknown(),
        })
        .refine((value) => value.imageBase64 ?? value.imageStoragePath, {
          message: "画像ファイルが指定されていません",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!canWriteSurveyMap(ctx.session.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "保存権限がありません",
        });
      }
      if (
        input.imageStoragePath &&
        !input.imageStoragePath.startsWith(
          `extracts/${ctx.session.tenant.id}/${ctx.session.user.id}/`,
        )
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "アップロードファイルにアクセスできません",
        });
      }

      const imageUrl = input.imageStoragePath
        ? getPublicImageUrl(input.imageStoragePath)
        : await uploadImage(input.imageBase64!, input.imageMimeType);
      const record = await ctx.db.surveyMap.create({
        data: {
          tenantId: ctx.session.tenant.id,
          name: input.name,
          imageUrl,
          extractedData: input.extractedData as object,
          createdById: ctx.session.user.id,
        },
      });

      await recordActivity({
        session: ctx.session,
        action: "survey_map.create",
        targetType: "survey_map",
        targetId: record.id,
        metadata: { name: record.name },
      });

      return record;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.surveyMap.findFirst({
        where: {
          id: input.id,
          ...(ctx.session.role !== "SUPER_ADMIN" && {
            tenantId: ctx.session.tenant.id,
          }),
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.surveyMap.findMany({
      where:
        ctx.session.role === "SUPER_ADMIN"
          ? undefined
          : { tenantId: ctx.session.tenant.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        extractedData: true,
        createdAt: true,
      },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        extractedData: z.unknown().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!canWriteSurveyMap(ctx.session.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "更新権限がありません",
        });
      }

      const record = await ctx.db.surveyMap.findFirst({
        where: {
          id: input.id,
          ...(ctx.session.role !== "SUPER_ADMIN" && {
            tenantId: ctx.session.tenant.id,
          }),
        },
      });
      if (!record)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "レコードが見つかりません",
        });

      const updated = await ctx.db.surveyMap.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.extractedData !== undefined && {
            extractedData: input.extractedData as object,
          }),
        },
      });

      await recordActivity({
        session: ctx.session,
        action: "survey_map.update",
        targetType: "survey_map",
        targetId: updated.id,
        metadata: {
          nameChanged: input.name !== undefined,
          dataChanged: input.extractedData !== undefined,
        },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!canDeleteSurveyMap(ctx.session.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "削除権限がありません",
        });
      }

      const record = await ctx.db.surveyMap.findFirst({
        where: {
          id: input.id,
          ...(ctx.session.role !== "SUPER_ADMIN" && {
            tenantId: ctx.session.tenant.id,
          }),
        },
      });
      if (!record)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "レコードが見つかりません",
        });
      await deleteImage(record.imageUrl);
      const deleted = await ctx.db.surveyMap.delete({
        where: { id: input.id },
      });

      await recordActivity({
        session: ctx.session,
        action: "survey_map.delete",
        targetType: "survey_map",
        targetId: deleted.id,
        metadata: { name: deleted.name },
      });

      return deleted;
    }),
});
