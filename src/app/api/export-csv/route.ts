import { type NextRequest, NextResponse } from "next/server";
import { generateSurveyCsv } from "~/lib/export-tabular";
import { type SurveyData } from "~/lib/dxf";
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
    const csv = generateSurveyCsv(data);
    const filename = `${data.survey_metadata.location_id}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("CSV export failed", error);
    return NextResponse.json(
      { error: "CSV生成に失敗しました" },
      { status: 500 },
    );
  }
}
