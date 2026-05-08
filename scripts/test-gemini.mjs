import { readFileSync } from "fs";

const envFile = readFileSync("/Users/fujita/dev/chiseki_app/.env", "utf-8");
const API_KEY = envFile.match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const IMAGE_PATH = "/Users/fujita/Downloads/geographic-survey-map-viewpoint01.jpg";

const prompt = `この地積測量図の画像から、以下の情報をJSON形式で正確に抽出してください。

{
  "survey_metadata": {
    "title": "図面タイトル",
    "location_id": "地番",
    "geodetic_system": "測地系",
    "coordinate_system": "座標系",
    "scale_factor": 縮尺係数(数値),
    "survey_date": "測量年月日"
  },
  "parcels": [
    {
      "parcel_id": "地番ID",
      "area_m2": 地積(数値),
      "coordinates": [
        { "point": "測点名", "x": X座標(数値), "y": Y座標(数値) }
      ]
    }
  ],
  "reference_points": [
    { "point": "測点名", "x": X座標(数値), "y": Y座標(数値) }
  ]
}

数値は文字列ではなく数値型で返してください。`;

const imageData = readFileSync(IMAGE_PATH);
const base64Image = imageData.toString("base64");

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0,
      },
    }),
  }
);

const result = await response.json();

if (!response.ok) {
  console.error("APIエラー:", JSON.stringify(result, null, 2));
  process.exit(1);
}

const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
const parsed = JSON.parse(text);
console.log(JSON.stringify(parsed, null, 2));
