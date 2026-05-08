import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { supabase, STORAGE_BUCKET } from "~/lib/supabase";

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
      const ext = input.imageMimeType.split("/")[1] ?? "jpg";
      const filename = `${Date.now()}.${ext}`;
      const buffer = Buffer.from(input.imageBase64, "base64");

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filename, buffer, { contentType: input.imageMimeType });

      if (uploadError) throw new Error(`画像アップロード失敗: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filename);

      return ctx.db.surveyMap.create({
        data: {
          name: input.name,
          imageUrl: publicUrl,
          extractedData: input.extractedData as object,
        },
      });
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

      const filename = record.imageUrl.split("/").pop();
      if (filename) {
        await supabase.storage.from(STORAGE_BUCKET).remove([filename]);
      }

      return ctx.db.surveyMap.delete({ where: { id: input.id } });
    }),
});
