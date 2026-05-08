import { type Coordinate, type Parcel, type SurveyData } from "~/lib/dxf";

export type AreaCheck = {
  parcelId: string;
  recordedArea: number;
  calculatedArea: number;
  difference: number;
  differenceRate: number;
  tolerance: number;
  status: "ok" | "warning";
};

export type SurveyIssue = {
  level: "error" | "warning" | "info";
  title: string;
  message: string;
  parcelId?: string;
  point?: string;
};

const areaTolerance = (recordedArea: number) =>
  Math.max(0.05, Math.abs(recordedArea) * 0.001);

const coordinateKey = (coordinate: Coordinate) =>
  `${coordinate.x.toFixed(3)},${coordinate.y.toFixed(3)}`;

const distance = (a: Coordinate, b: Coordinate) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function calculateParcelArea(parcel: Parcel): number {
  const points = parcel.coordinates.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (points.length < 3) return 0;

  const doubleArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    // 測量座標は X=北方向、Y=東方向。面積計算では横軸=Y、縦軸=Xとして扱う。
    return sum + point.y * next.x - next.y * point.x;
  }, 0);

  return Math.abs(doubleArea) / 2;
}

export function getAreaChecks(data: SurveyData): AreaCheck[] {
  return data.parcels.map((parcel) => {
    const calculatedArea = calculateParcelArea(parcel);
    const difference = calculatedArea - parcel.area_m2;
    const tolerance = areaTolerance(parcel.area_m2);
    const differenceRate =
      parcel.area_m2 === 0
        ? 0
        : Math.abs(difference) / Math.abs(parcel.area_m2);

    return {
      parcelId: parcel.parcel_id,
      recordedArea: parcel.area_m2,
      calculatedArea,
      difference,
      differenceRate,
      tolerance,
      status: Math.abs(difference) <= tolerance ? "ok" : "warning",
    };
  });
}

export function getSurveyIssues(data: SurveyData): SurveyIssue[] {
  const issues: SurveyIssue[] = [];
  const areaChecks = getAreaChecks(data);

  if (!data.survey_metadata.coordinate_system?.trim()) {
    issues.push({
      level: "warning",
      title: "座標系が未入力です",
      message: "地図表示や座標変換の前に第1系〜第19系を確認してください。",
    });
  }

  for (const parcel of data.parcels) {
    if (parcel.coordinates.length < 3) {
      issues.push({
        level: "error",
        title: "構成点が不足しています",
        message: "筆界ポリゴンを作るには3点以上の座標が必要です。",
        parcelId: parcel.parcel_id,
      });
    }

    const pointNames = new Map<string, number>();
    const coordinateNames = new Map<string, string[]>();

    parcel.coordinates.forEach((point) => {
      if (!point.point.trim()) {
        issues.push({
          level: "warning",
          title: "点名が空です",
          message: "測点名を確認してください。",
          parcelId: parcel.parcel_id,
        });
      }

      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        issues.push({
          level: "error",
          title: "座標値が不正です",
          message: "X座標またはY座標が数値として扱えません。",
          parcelId: parcel.parcel_id,
          point: point.point,
        });
      }

      pointNames.set(point.point, (pointNames.get(point.point) ?? 0) + 1);
      const key = coordinateKey(point);
      coordinateNames.set(key, [
        ...(coordinateNames.get(key) ?? []),
        point.point,
      ]);
    });

    for (const [point, count] of pointNames) {
      if (point && count > 1) {
        issues.push({
          level: "warning",
          title: "点名が重複しています",
          message: `${point} が同じ筆内で ${count} 回出現しています。`,
          parcelId: parcel.parcel_id,
          point,
        });
      }
    }

    for (const [key, points] of coordinateNames) {
      if (points.length > 1) {
        issues.push({
          level: "warning",
          title: "同一座標が重複しています",
          message: `${points.join("、")} が同じ座標 (${key}) です。`,
          parcelId: parcel.parcel_id,
        });
      }
    }

    const segmentLengths = parcel.coordinates.map((point, index) =>
      distance(
        point,
        parcel.coordinates[(index + 1) % parcel.coordinates.length] ?? point,
      ),
    );
    const sortedLengths = [...segmentLengths].sort((a, b) => a - b);
    const medianLength =
      sortedLengths[Math.floor(sortedLengths.length / 2)] ?? 0;
    segmentLengths.forEach((length, index) => {
      if (medianLength > 0 && length > Math.max(medianLength * 10, 1000)) {
        issues.push({
          level: "warning",
          title: "極端に長い辺があります",
          message: `${parcel.coordinates[index]?.point ?? "不明"} 付近の距離が他の辺より大きく、OCRミスの可能性があります。`,
          parcelId: parcel.parcel_id,
          point: parcel.coordinates[index]?.point,
        });
      }
    });
  }

  for (const check of areaChecks) {
    if (check.status === "warning") {
      issues.push({
        level: "warning",
        title: "面積差が閾値を超えています",
        message: `記載面積 ${check.recordedArea.toFixed(2)}㎡ に対し、座標計算面積は ${check.calculatedArea.toFixed(2)}㎡ です。`,
        parcelId: check.parcelId,
      });
    }
  }

  return issues;
}

export function getIssueCounts(issues: SurveyIssue[]) {
  return {
    error: issues.filter((issue) => issue.level === "error").length,
    warning: issues.filter((issue) => issue.level === "warning").length,
    info: issues.filter((issue) => issue.level === "info").length,
  };
}
