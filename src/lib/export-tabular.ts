import ExcelJS from "exceljs";
import { type SurveyData } from "~/lib/dxf";
import {
  getAreaChecks,
  getSurveyCalculationMethod,
  getSurveyIssues,
  isCoordinateBasedSurvey,
} from "~/lib/survey-validation";

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (rows: (string | number | null | undefined)[][]) =>
  `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

export function generateSurveyCsv(data: SurveyData) {
  if (!isCoordinateBasedSurvey(data)) {
    return generateAreaOnlyCsv(data);
  }

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

const methodLabel = (method: string | undefined) => {
  switch (method) {
    case "coordinate":
      return "座標求積";
    case "triangulation":
      return "三斜求積";
    case "residual":
      return "残地求積";
    case "mixed":
      return "混在";
    case "area_only":
      return "面積のみ";
    default:
      return "不明";
  }
};

const roundArea = (value: number) => Number(value.toFixed(4));

const calculateAreaFromNotes = (
  notes: string | undefined,
  method: string | undefined,
) => {
  if (!notes) {
    return null;
  }

  if (method === "triangulation") {
    const products = [
      ...notes.matchAll(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/g),
    ];
    if (products.length === 0) {
      return null;
    }

    const doubledArea = products.reduce((sum, match) => {
      const width = Number(match[1]);
      const height = Number(match[2]);
      return sum + width * height;
    }, 0);

    return roundArea(doubledArea / 2);
  }

  if (method === "residual") {
    const residual = /(\d+(?:\.\d+)?)\s*-\s*\(([^)]*)\)/.exec(notes);
    if (!residual) {
      return null;
    }

    const baseArea = Number(residual[1]);
    const deductedAreaText = residual[2] ?? "";
    const deductedAreas = [
      ...deductedAreaText.matchAll(/\d+(?:\.\d+)?/g),
    ].reduce((sum, match) => sum + Number(match[0]), 0);

    return roundArea(baseArea - deductedAreas);
  }

  return null;
};

const nonCoordinateAreaValues = (
  parcel: SurveyData["parcels"][number],
  fallbackMethod: SurveyData["survey_metadata"]["calculation_method"],
) => {
  const method = parcel.calculation_method ?? fallbackMethod;
  const calculatedArea = calculateAreaFromNotes(
    parcel.calculation_notes,
    method,
  );
  const difference =
    calculatedArea === null ? null : roundArea(calculatedArea - parcel.area_m2);
  const status =
    calculatedArea === null
      ? "対象外"
      : Math.abs(difference ?? 0) <= 0.01
        ? "OK"
        : "要確認";

  return { method, calculatedArea, difference, status };
};

function generateAreaOnlyCsv(data: SurveyData) {
  const areaChecks = getAreaChecks(data);
  const rows: (string | number | null | undefined)[][] = [
    [
      "地番",
      "種別",
      "求積方式",
      "記載面積㎡",
      "根拠計算面積㎡",
      "差分㎡",
      "判定",
      "計算式・根拠",
      "備考",
    ],
  ];

  for (const parcel of data.parcels) {
    const area = areaChecks.find(
      (check) => check.parcelId === parcel.parcel_id,
    );
    const values = nonCoordinateAreaValues(
      parcel,
      data.survey_metadata.calculation_method,
    );
    rows.push([
      parcel.parcel_id,
      values.method === "residual" ? "残地" : "筆",
      methodLabel(values.method),
      parcel.area_m2,
      values.calculatedArea?.toFixed(4) ?? "",
      values.difference?.toFixed(4) ?? "",
      values.status,
      parcel.calculation_notes ?? "",
      area?.reason ?? "",
    ]);
  }

  if (data.adjacent_parcels.length > 0) {
    rows.push([]);
    rows.push([
      "隣接",
      "",
      "",
      "",
      "",
      "",
      "",
      data.adjacent_parcels.join("、"),
      "",
    ]);
  }

  if (data.survey_metadata.method_evidence?.length) {
    rows.push([]);
    rows.push([
      "分類根拠",
      "",
      methodLabel(getSurveyCalculationMethod(data)),
      "",
      "",
      "",
      "",
      data.survey_metadata.method_evidence.join("、"),
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
  workbook.creator = "地積測量図OCR";
  workbook.created = new Date();
  const areaChecks = getAreaChecks(data);
  const issues = getSurveyIssues(data);
  const coordinateBased = isCoordinateBasedSurvey(data);

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
      求積方式: methodLabel(getSurveyCalculationMethod(data)),
      座標状態: data.survey_metadata.coordinate_status ?? "",
    },
  ]);

  if (coordinateBased) {
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
          求積方式: methodLabel(parcel.calculation_method),
          備考: area?.reason ?? parcel.calculation_notes ?? "",
        };
      }),
    );
  } else {
    addJsonSheet(
      workbook,
      "面積・求積根拠",
      data.parcels.map((parcel) => {
        const area = areaChecks.find(
          (check) => check.parcelId === parcel.parcel_id,
        );
        const values = nonCoordinateAreaValues(
          parcel,
          data.survey_metadata.calculation_method,
        );
        return {
          地番: parcel.parcel_id,
          種別: values.method === "residual" ? "残地" : "筆",
          求積方式: methodLabel(values.method),
          "記載面積㎡": parcel.area_m2,
          "根拠計算面積㎡":
            values.calculatedArea === null
              ? ""
              : Number(values.calculatedArea.toFixed(4)),
          "差分㎡":
            values.difference === null
              ? ""
              : Number(values.difference.toFixed(4)),
          判定: values.status,
          "計算式・根拠": parcel.calculation_notes ?? "",
          備考: area?.reason ?? "",
        };
      }),
    );

    addJsonSheet(workbook, "分類根拠", [
      {
        求積方式: methodLabel(getSurveyCalculationMethod(data)),
        確信度: data.survey_metadata.method_confidence ?? "",
        根拠: data.survey_metadata.method_evidence?.join("、") ?? "",
        隣接: data.adjacent_parcels.join("、"),
      },
    ]);
  }

  if (coordinateBased) {
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
  }

  if (coordinateBased || data.reference_points.length > 0) {
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
  }

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
