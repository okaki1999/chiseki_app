import ExcelJS from "exceljs";
import { type SurveyData } from "~/lib/dxf";
import { getAreaChecks, getSurveyIssues } from "~/lib/survey-validation";

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (rows: (string | number | null | undefined)[][]) =>
  `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

export function generateSurveyCsv(data: SurveyData) {
  const areaChecks = getAreaChecks(data);
  const rows: (string | number | null | undefined)[][] = [
    [
      "種別",
      "筆ID",
      "測点",
      "X座標",
      "Y座標",
      "境界標",
      "記載面積㎡",
      "座標計算面積㎡",
      "差分㎡",
      "差分率%",
    ],
  ];

  for (const parcel of data.parcels) {
    const area = areaChecks.find(
      (check) => check.parcelId === parcel.parcel_id,
    );
    for (const coordinate of parcel.coordinates) {
      rows.push([
        "筆界点",
        parcel.parcel_id,
        coordinate.point,
        coordinate.x,
        coordinate.y,
        coordinate.marker_type ?? "",
        parcel.area_m2,
        area?.calculatedArea?.toFixed(3),
        area?.difference?.toFixed(3),
        area?.differenceRate !== null && area?.differenceRate !== undefined
          ? (area.differenceRate * 100).toFixed(3)
          : "",
      ]);
    }
    if (parcel.coordinates.length === 0) {
      rows.push([
        "筆",
        parcel.parcel_id,
        "",
        "",
        "",
        "",
        parcel.area_m2,
        area?.calculatedArea?.toFixed(3),
        area?.difference?.toFixed(3),
        area?.differenceRate !== null && area?.differenceRate !== undefined
          ? (area.differenceRate * 100).toFixed(3)
          : "",
      ]);
    }
  }

  for (const point of data.reference_points) {
    rows.push([
      "基準点",
      "",
      point.point,
      point.x,
      point.y,
      point.marker_type ?? "",
      "",
      "",
      "",
      "",
    ]);
  }

  return toCsv(rows);
}

type SheetRow = Record<string, string | number>;

const addJsonSheet = (
  workbook: ExcelJS.Workbook,
  name: string,
  rows: SheetRow[],
) => {
  const worksheet = workbook.addWorksheet(name);
  const keys = Object.keys(rows[0] ?? { データ: "" });
  worksheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.max(12, Math.min(32, key.length * 2 + 4)),
  }));

  rows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF6FF" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
};

export async function generateSurveyWorkbookBuffer(
  data: SurveyData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zahyoc";
  workbook.created = new Date();
  const areaChecks = getAreaChecks(data);
  const issues = getSurveyIssues(data);

  addJsonSheet(workbook, "基本情報", [
    {
      地番: data.survey_metadata.location_id,
      測地系: data.survey_metadata.geodetic_system,
      座標系: data.survey_metadata.coordinate_system ?? "",
      縮尺係数: data.survey_metadata.scale_factor,
      測量年月日: data.survey_metadata.survey_date,
      測量士: data.survey_metadata.surveyor ?? "",
      作成者: data.survey_metadata.creator_organization ?? "",
      申請人: data.survey_metadata.applicant ?? "",
    },
  ]);

  addJsonSheet(
    workbook,
    "筆一覧",
    data.parcels.map((parcel) => {
      const area = areaChecks.find(
        (check) => check.parcelId === parcel.parcel_id,
      );
      return {
        筆ID: parcel.parcel_id,
        "記載面積㎡": parcel.area_m2,
        "座標計算面積㎡":
          area?.calculatedArea === null || area?.calculatedArea === undefined
            ? ""
            : Number(area.calculatedArea.toFixed(3)),
        "差分㎡":
          area?.difference === null || area?.difference === undefined
            ? ""
            : Number(area.difference.toFixed(3)),
        差分率:
          area?.differenceRate === null || area?.differenceRate === undefined
            ? ""
            : `${(area.differenceRate * 100).toFixed(3)}%`,
        判定:
          area?.status === "ok"
            ? "OK"
            : area?.status === "skipped"
              ? "対象外"
              : "要確認",
        点数: parcel.coordinates.length,
        求積方式: parcel.calculation_method ?? "",
        備考: area?.reason ?? parcel.calculation_notes ?? "",
      };
    }),
  );

  addJsonSheet(
    workbook,
    "測点一覧",
    data.parcels.flatMap((parcel) =>
      parcel.coordinates.map((coordinate, index) => ({
        筆ID: parcel.parcel_id,
        No: index + 1,
        測点: coordinate.point,
        X座標: coordinate.x,
        Y座標: coordinate.y,
        境界標: coordinate.marker_type ?? "",
      })),
    ),
  );

  addJsonSheet(
    workbook,
    "基準点",
    data.reference_points.length > 0
      ? data.reference_points.map((point, index) => ({
          No: index + 1,
          測点: point.point,
          X座標: point.x,
          Y座標: point.y,
          境界標: point.marker_type ?? "",
        }))
      : [{ No: "", 測点: "", X座標: "", Y座標: "", 境界標: "" }],
  );

  addJsonSheet(
    workbook,
    "要確認",
    issues.length > 0
      ? issues.map((issue) => ({
          レベル: issue.level,
          タイトル: issue.title,
          内容: issue.message,
          筆ID: issue.parcelId ?? "",
          測点: issue.point ?? "",
        }))
      : [{ レベル: "OK", タイトル: "問題なし", 内容: "", 筆ID: "", 測点: "" }],
  );

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
