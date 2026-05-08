import { type NextRequest, NextResponse } from "next/server";
import iconv from "iconv-lite";
import { generateDXF, type SurveyData } from "~/lib/dxf";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as SurveyData;
    const dxf = generateDXF(data);

    // CADソフトはShift-JISを期待するためエンコード変換
    const buffer = iconv.encode(dxf, "Shift_JIS");
    const filename = `${data.survey_metadata.location_id}.dxf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "DXF生成に失敗しました" }, { status: 500 });
  }
}
