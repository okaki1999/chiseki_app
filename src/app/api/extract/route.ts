import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { recordActivity } from "~/server/activity";
import { resolveAppSession } from "~/server/auth";
import { db } from "~/server/db";

const MODEL = "gemini-3-flash-preview";

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
    "applicant": "申請人名（あれば）",
    "calculation_method": "coordinate | triangulation | residual | mixed | area_only | unknown のいずれか。座標求積、三斜求積、残地求積、混在、面積のみ、不明を分類",
    "method_confidence": 分類の確信度(0〜1の数値),
    "method_evidence": ["分類根拠。例: 座標表あり、三斜計算式あり、残地表示あり、座標値なし"],
    "coordinate_status": "public_coordinates | local_coordinates | no_coordinates | unknown のいずれか。公共座標、任意/局所座標、座標なし、不明を分類",
    "document_type": "survey_map | cadastral_map | boundary_photo | unknown のいずれか"
  },
  "parcels": [
    {
      "parcel_id": "地番ID",
      "area_m2": 地積(数値),
      "calculation_method": "coordinate | triangulation | residual | area_only | unknown のいずれか",
      "calculation_notes": "三斜や残地の計算式、読み取れた根拠。なければ空文字",
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

数値は文字列ではなく数値型で返してください。境界標の種類は座標求積表の備考列から読み取ってください。
座標表がない古い図面（三斜求積・残地求積・辺長のみ）の場合は、coordinates は無理に作らず空配列にしてください。その場合でも地番、面積、求積方式、残地計算式や三斜計算式の根拠を抽出してください。
「残地」「差引」「控除」「全体面積から他筆面積を引く」式がある場合は residual、底辺×高さ÷2 の求積欄が中心なら triangulation、座標表があり3点以上の座標から面積を出せる場合は coordinate と分類してください。`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { base64: string; mimeType: string };
    const session = await resolveAppSession(db, req.headers);
    if (!session) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 },
      );
    }

    if (!body.base64 || !isSupportedMimeType(body.mimeType)) {
      return NextResponse.json(
        { error: "JPG、PNGなどの画像、またはPDFをアップロードしてください" },
        { status: 400 },
      );
    }

    if (session.user.usageLimit !== null && session.user.usageLimit <= 0) {
      return NextResponse.json(
        {
          error: "解析回数の残りがありません",
        },
        { status: 403 },
      );
    }

    const reservedUser =
      session.user.usageLimit === null
        ? null
        : await db.user.updateMany({
            where: {
              id: session.user.id,
              usageLimit: { gt: 0 },
            },
            data: {
              usageLimit: { decrement: 1 },
            },
          });

    if (reservedUser && reservedUser.count === 0) {
      return NextResponse.json(
        {
          error: "解析回数の残りがありません",
        },
        { status: 403 },
      );
    }

    try {
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
                  {
                    inline_data: {
                      mime_type: body.mimeType,
                      data: body.base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0,
              thinkingConfig: {
                thinkingLevel: "low",
              },
            },
          }),
        },
      );

      const result = (await response.json()) as {
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
      await recordActivity({
        session,
        action: "ocr.extract",
        metadata: { mimeType: body.mimeType },
        usage: true,
      });
      return NextResponse.json(parsed);
    } catch (error) {
      if (reservedUser) {
        await db.user.update({
          where: { id: session.user.id },
          data: { usageLimit: { increment: 1 } },
        });
      }
      throw error;
    }
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
