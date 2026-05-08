import { type NextRequest, NextResponse } from "next/server";
import { type SurveyData } from "~/lib/dxf";
import { generateSurveyWorkbookBuffer } from "~/lib/export-tabular";
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
    const buffer = await generateSurveyWorkbookBuffer(data);
    const filename = `${data.survey_metadata.location_id}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Excel export failed", error);
    return NextResponse.json(
      { error: "Excel生成に失敗しました" },
      { status: 500 },
    );
  }
}
