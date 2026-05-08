import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

const MODEL = "gemini-2.5-flash";

const SUPPORTED_MIME_TYPES = new Set(["application/pdf"]);

const isSupportedMimeType = (mimeType: string) =>
  mimeType.startsWith("image/") || SUPPORTED_MIME_TYPES.has(mimeType);

const PROMPT = `この地積測量図の画像またはPDFから、以下の情報をJSON形式で正確に抽出してください。PDFが複数ページの場合は、地積測量図として最も関連するページを優先して読み取ってください。

{
  "survey_metadata": {
    "location_id": "地番（例: 1374番1、1374番3）",
    "geodetic_system": "測地系",
    "coordinate_system": "座標系番号",
    "scale_factor": 縮尺係数(数値),
    "survey_date": "測量年月日",
    "surveyor": "測量士氏名（あれば）",
    "creator_organization": "作成者組織名（あれば）",
    "applicant": "申請人名（あれば）"
  },
  "parcels": [
    {
      "parcel_id": "地番ID",
      "area_m2": 地積(数値),
      "coordinates": [
        {
          "point": "測点名",
          "x": X座標(数値),
          "y": Y座標(数値),
          "marker_type": "境界標の種類（コンクリート杭、プラスチック杭、鋲、石杭、計算点等）"
        }
      ]
    }
  ],
  "reference_points": [
    {
      "point": "測点名",
      "x": X座標(数値),
      "y": Y座標(数値),
      "marker_type": "境界標の種類（あれば）"
    }
  ],
  "adjacent_parcels": ["隣接している地番のリスト（図面に記載されているもの）"]
}

数値は文字列ではなく数値型で返してください。境界標の種類は座標求積表の備考列から読み取ってください。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { base64: string; mimeType: string };

    if (!body.base64 || !isSupportedMimeType(body.mimeType)) {
      return NextResponse.json(
        { error: "JPG、PNGなどの画像、またはPDFをアップロードしてください" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: body.mimeType, data: body.base64 } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0,
          },
        }),
      },
    );

    const result = await response.json() as {
      candidates?: { content: { parts: { text: string }[] } }[];
      error?: { message: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error?.message ?? "APIエラー" },
        { status: response.status },
      );
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as unknown;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
