import { type NextRequest, NextResponse } from "next/server";
import iconv from "iconv-lite";
import { type SurveyData } from "~/lib/dxf";
import { generateSIMA } from "~/lib/sima";
import { recordActivity } from "~/server/activity";
import { resolveAppSession } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(req: NextRequest) {
  try {
    const session = await resolveAppSession(db, req.headers);
    if (!session) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
    }

    const data = (await req.json()) as SurveyData;
    const sima = generateSIMA(data);
    const buffer = iconv.encode(sima, "Shift_JIS");
    const filename = `${data.survey_metadata.location_id}.sim`;
    await recordActivity({
      session,
      action: "export.sima",
      metadata: { locationId: data.survey_metadata.location_id },
      usage: true,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "SIMA生成に失敗しました" },
      { status: 500 },
    );
  }
}
