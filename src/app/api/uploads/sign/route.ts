import { type NextRequest, NextResponse } from "next/server";
import { getSupabase } from "~/lib/supabase";
import { STORAGE_BUCKET } from "~/lib/storage";
import { resolveAppSession } from "~/server/auth";
import { db } from "~/server/db";

const SUPPORTED_MIME_TYPES = new Set(["application/pdf"]);

const isSupportedMimeType = (mimeType: string) =>
  mimeType.startsWith("image/") || SUPPORTED_MIME_TYPES.has(mimeType);

const extensionFromMimeType = (mimeType: string) => {
  if (mimeType === "application/pdf") return "pdf";
  const subtype = mimeType.split("/")[1]?.split("+")[0];
  return subtype?.replace(/[^a-z0-9]/gi, "").toLowerCase() ?? "bin";
};

export async function POST(req: NextRequest) {
  try {
    const session = await resolveAppSession(db, req.headers);
    if (!session) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as { mimeType?: string };
    const mimeType = body.mimeType ?? "";
    if (!isSupportedMimeType(mimeType)) {
      return NextResponse.json(
        { error: "JPG、PNGなどの画像、またはPDFをアップロードしてください" },
        { status: 400 },
      );
    }

    const ext = extensionFromMimeType(mimeType);
    const path = [
      "extracts",
      session.tenant.id,
      session.user.id,
      `${Date.now()}-${crypto.randomUUID()}.${ext}`,
    ].join("/");

    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("/api/uploads/sign storage error", {
        bucket: STORAGE_BUCKET,
        message: error.message,
      });
      return NextResponse.json(
        { error: `アップロードURLの作成に失敗しました: ${error.message}` },
        { status: 500 },
      );
    }

    const publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
      .data.publicUrl;

    return NextResponse.json({
      path,
      token: data.token,
      publicUrl,
    });
  } catch (error) {
    console.error("/api/uploads/sign failed", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
