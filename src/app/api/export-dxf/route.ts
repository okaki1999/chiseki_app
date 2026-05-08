import { type NextRequest, NextResponse } from "next/server";
import iconv from "iconv-lite";
import { generateDXF, type SurveyData } from "~/lib/dxf";
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
    const dxf = generateDXF(data);

    // CADソフトはShift-JISを期待するためエンコード変換
    const buffer = iconv.encode(dxf, "Shift_JIS");
    const filename = `${data.survey_metadata.location_id}.dxf`;
    await recordActivity({
      session,
      action: "export.dxf",
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
      { error: "DXF生成に失敗しました" },
      { status: 500 },
    );
  }
}
