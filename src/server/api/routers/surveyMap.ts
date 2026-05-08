import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { getSupabase, STORAGE_BUCKET } from "~/lib/supabase";

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
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename).data.publicUrl;
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
    const filename = imageUrl.split("/").pop();
    if (filename) {
      await getSupabase().storage.from(STORAGE_BUCKET).remove([filename]);
    }
  }
}

export const surveyMapRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        imageBase64: z.string(),
        imageMimeType: z.string(),
        extractedData: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const imageUrl = await uploadImage(input.imageBase64, input.imageMimeType);
      return ctx.db.surveyMap.create({
        data: {
          name: input.name,
          imageUrl,
          extractedData: input.extractedData as object,
        },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.surveyMap.findUnique({ where: { id: input.id } });
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.surveyMap.findMany({
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

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.surveyMap.findUnique({ where: { id: input.id } });
      if (!record) throw new Error("レコードが見つかりません");
      await deleteImage(record.imageUrl);
      return ctx.db.surveyMap.delete({ where: { id: input.id } });
    }),
});
