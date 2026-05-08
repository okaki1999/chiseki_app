"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import proj4 from "proj4";
import { getAuthHeaders } from "~/lib/auth-headers";
import { type SurveyData, type Coordinate } from "~/lib/dxf";
import {
  getAreaChecks,
  getIssueCounts,
  getSurveyCalculationMethod,
  getSurveyIssues,
  hasAnyUsableCoordinates,
  isCoordinateBasedSurvey,
  type SurveyIssue,
} from "~/lib/survey-validation";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

function MetaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-sm font-medium text-gray-800 focus:ring-1 focus:ring-blue-400 focus:outline-none"
      />
    </div>
  );
}

function CoordTable({ rows }: { rows: Coordinate[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-400">
          <th className="pr-4 pb-2 font-normal">測点</th>
          <th className="pr-4 pb-2 font-normal">X座標</th>
          <th className="pr-4 pb-2 font-normal">Y座標</th>
          <th className="pb-2 font-normal">境界標</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.point} className="border-b last:border-0">
            <td className="py-2 pr-4 font-mono font-semibold text-gray-700">
              {c.point}
            </td>
            <td className="py-2 pr-4 font-mono text-gray-600">
              {c.x.toFixed(3)}
            </td>
            <td className="py-2 pr-4 font-mono text-gray-600">
              {c.y.toFixed(3)}
            </td>
            <td className="py-2 text-gray-500">{c.marker_type ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CoordTableEdit({
  rows,
  onChange,
}: {
  rows: Coordinate[];
  onChange: (rows: Coordinate[]) => void;
}) {
  const update = (i: number, field: keyof Coordinate, value: string) => {
    const next = rows.map((r, idx) =>
      idx === i
        ? {
            ...r,
            [field]:
              field === "x" || field === "y"
                ? parseFloat(value) || 0
                : value || undefined,
          }
        : r,
    );
    onChange(next);
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-400">
          <th className="pr-2 pb-2 font-normal">測点</th>
          <th className="pr-2 pb-2 font-normal">X座標</th>
          <th className="pr-2 pb-2 font-normal">Y座標</th>
          <th className="pb-2 font-normal">境界標</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-1 pr-2">
              <input
                value={c.point}
                onChange={(e) => update(i, "point", e.target.value)}
                className="w-16 rounded border border-blue-200 px-1 py-0.5 font-mono text-sm font-semibold text-gray-700 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
            </td>
            <td className="py-1 pr-2">
              <input
                type="number"
                step="0.001"
                value={c.x}
                onChange={(e) => update(i, "x", e.target.value)}
                className="w-32 rounded border border-blue-200 px-1 py-0.5 font-mono text-sm text-gray-600 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
            </td>
            <td className="py-1 pr-2">
              <input
                type="number"
                step="0.001"
                value={c.y}
                onChange={(e) => update(i, "y", e.target.value)}
                className="w-32 rounded border border-blue-200 px-1 py-0.5 font-mono text-sm text-gray-600 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
            </td>
            <td className="py-1">
              <input
                value={c.marker_type ?? ""}
                onChange={(e) => update(i, "marker_type", e.target.value)}
                placeholder="—"
                className="w-24 rounded border border-blue-200 px-1 py-0.5 text-sm text-gray-500 focus:ring-1 focus:ring-blue-400 focus:outline-none"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function issueStyle(level: SurveyIssue["level"]) {
  if (level === "error") {
    return {
      label: "エラー",
      badge: "bg-red-100 text-red-700",
      row: "border-red-100 bg-red-50",
    };
  }
  if (level === "warning") {
    return {
      label: "警告",
      badge: "bg-amber-100 text-amber-700",
      row: "border-amber-100 bg-amber-50",
    };
  }
  return {
    label: "情報",
    badge: "bg-blue-100 text-blue-700",
    row: "border-blue-100 bg-blue-50",
  };
}

function ValidationSummary({ data }: { data: SurveyData }) {
  const areaChecks = getAreaChecks(data);
  const issues = getSurveyIssues(data);
  const counts = getIssueCounts(issues);
  const coordinateBased = isCoordinateBasedSurvey(data);

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
          検算・要確認
        </h2>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
            エラー {counts.error}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            警告 {counts.warning}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
            情報 {counts.info}
          </span>
        </div>
      </div>

      <div className="mb-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-400">
              <th className="pr-4 pb-2 font-normal">筆ID</th>
              <th className="pr-4 pb-2 text-right font-normal">記載面積</th>
              {coordinateBased && (
                <>
                  <th className="pr-4 pb-2 text-right font-normal">
                    座標計算面積
                  </th>
                  <th className="pr-4 pb-2 text-right font-normal">差分</th>
                </>
              )}
              <th className="pb-2 font-normal">判定</th>
            </tr>
          </thead>
          <tbody>
            {areaChecks.map((check) => (
              <tr key={check.parcelId} className="border-b last:border-0">
                <td className="py-2 pr-4 font-semibold text-gray-700">
                  {check.parcelId}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-gray-600">
                  {check.recordedArea.toFixed(2)}㎡
                </td>
                {coordinateBased && (
                  <>
                    <td className="py-2 pr-4 text-right font-mono text-gray-600">
                      {check.calculatedArea === null
                        ? "—"
                        : `${check.calculatedArea.toFixed(2)}㎡`}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right font-mono ${
                        check.status === "ok"
                          ? "text-gray-600"
                          : "text-amber-700"
                      }`}
                    >
                      {check.difference === null
                        ? "—"
                        : `${check.difference >= 0 ? "+" : ""}${check.difference.toFixed(3)}㎡`}
                    </td>
                  </>
                )}
                <td className="py-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      check.status === "ok"
                        ? "bg-green-50 text-green-700"
                        : check.status === "skipped"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {check.status === "ok"
                      ? "OK"
                      : check.status === "skipped"
                        ? "対象外"
                        : "要確認"}
                  </span>
                  {check.reason && (
                    <p className="mt-1 text-xs text-gray-400">{check.reason}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          検出された問題はありません。
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, index) => {
            const style = issueStyle(issue.level);
            return (
              <div
                key={`${issue.level}-${issue.title}-${index}`}
                className={`rounded-lg border p-3 ${style.row}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}
                  >
                    {style.label}
                  </span>
                  {issue.parcelId && (
                    <span className="text-xs font-medium text-gray-500">
                      {issue.parcelId}
                      {issue.point ? ` / ${issue.point}` : ""}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-800">
                    {issue.title}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{issue.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const PREVIEW_COLORS = [
  { stroke: "#2563eb", fill: "#dbeafe" },
  { stroke: "#16a34a", fill: "#dcfce7" },
  { stroke: "#dc2626", fill: "#fee2e2" },
  { stroke: "#9333ea", fill: "#f3e8ff" },
  { stroke: "#0891b2", fill: "#cffafe" },
] as const;

type PreviewLabel = {
  key: string;
  text: string;
  pointX: number;
  pointY: number;
  x: number;
  y: number;
  fill: string;
  fontSize: number;
  fontWeight: number;
  textAnchor: "start" | "middle" | "end";
};

type LabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const labelRect = (
  x: number,
  y: number,
  text: string,
  fontSize: number,
  textAnchor: PreviewLabel["textAnchor"],
): LabelRect => {
  const width = Math.max(fontSize * 0.8, text.length * fontSize * 0.72);
  const height = fontSize + 5;
  const left =
    textAnchor === "end"
      ? x - width
      : textAnchor === "middle"
        ? x - width / 2
        : x;

  return {
    left,
    right: left + width,
    top: y - height,
    bottom: y + 4,
  };
};

const rectOverlapArea = (a: LabelRect, b: LabelRect) => {
  const width = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left),
  );
  const height = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  );
  return width * height;
};

function placePreviewLabels({
  items,
  width,
  height,
  padding,
  labelOffset,
}: {
  items: Array<{
    key: string;
    text: string;
    pointX: number;
    pointY: number;
    fill: string;
    fontSize: number;
    fontWeight: number;
  }>;
  width: number;
  height: number;
  padding: number;
  labelOffset: number;
}) {
  const placed: Array<PreviewLabel & { rect: LabelRect }> = [];
  const candidates = [
    { dx: labelOffset, dy: -labelOffset, anchor: "start" as const },
    { dx: labelOffset, dy: labelOffset + 6, anchor: "start" as const },
    { dx: -labelOffset, dy: -labelOffset, anchor: "end" as const },
    { dx: -labelOffset, dy: labelOffset + 6, anchor: "end" as const },
    { dx: 0, dy: -(labelOffset + 12), anchor: "middle" as const },
    { dx: 0, dy: labelOffset + 18, anchor: "middle" as const },
    { dx: labelOffset + 18, dy: 4, anchor: "start" as const },
    { dx: -(labelOffset + 18), dy: 4, anchor: "end" as const },
    { dx: labelOffset + 26, dy: -(labelOffset + 18), anchor: "start" as const },
    {
      dx: -(labelOffset + 26),
      dy: -(labelOffset + 18),
      anchor: "end" as const,
    },
    { dx: labelOffset + 26, dy: labelOffset + 22, anchor: "start" as const },
    { dx: -(labelOffset + 26), dy: labelOffset + 22, anchor: "end" as const },
  ];

  const pointRects = items.map((item) => ({
    left: item.pointX - 8,
    right: item.pointX + 8,
    top: item.pointY - 8,
    bottom: item.pointY + 8,
  }));

  for (const item of items) {
    const best = candidates
      .map((candidate, index) => {
        const x = item.pointX + candidate.dx;
        const y = item.pointY + candidate.dy;
        const rect = labelRect(
          x,
          y,
          item.text,
          item.fontSize,
          candidate.anchor,
        );
        const edgePenalty =
          Math.max(0, padding / 2 - rect.left) * 20 +
          Math.max(0, padding / 2 - rect.top) * 20 +
          Math.max(0, rect.right - (width - padding / 2)) * 20 +
          Math.max(0, rect.bottom - (height - padding / 2)) * 20;
        const labelPenalty = placed.reduce(
          (sum, label) => sum + rectOverlapArea(rect, label.rect) * 35,
          0,
        );
        const pointPenalty = pointRects.reduce(
          (sum, pointRect) => sum + rectOverlapArea(rect, pointRect) * 12,
          0,
        );

        return {
          candidate,
          rect,
          x,
          y,
          score: edgePenalty + labelPenalty + pointPenalty + index,
        };
      })
      .sort((a, b) => a.score - b.score)[0]!;

    placed.push({
      ...item,
      x: best.x,
      y: best.y,
      textAnchor: best.candidate.anchor,
      rect: best.rect,
    });
  }

  return placed;
}

const methodLabel = (
  method: ReturnType<typeof getSurveyCalculationMethod> | undefined,
) => {
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

const coordinateStatusLabel = (
  status: SurveyData["survey_metadata"]["coordinate_status"],
) => {
  switch (status) {
    case "public_coordinates":
      return "公共座標";
    case "local_coordinates":
      return "任意・局所座標";
    case "no_coordinates":
      return "座標なし";
    default:
      return "不明";
  }
};

type PlaneCoordinateSystem = {
  code: number;
  lat0: number;
  lon0: number;
};

const PLANE_COORDINATE_SYSTEMS: PlaneCoordinateSystem[] = [
  { code: 1, lat0: 33, lon0: 129.5 },
  { code: 2, lat0: 33, lon0: 131 },
  { code: 3, lat0: 36, lon0: 132 + 10 / 60 },
  { code: 4, lat0: 33, lon0: 133.5 },
  { code: 5, lat0: 36, lon0: 134 + 20 / 60 },
  { code: 6, lat0: 36, lon0: 136 },
  { code: 7, lat0: 36, lon0: 137 + 10 / 60 },
  { code: 8, lat0: 36, lon0: 138.5 },
  { code: 9, lat0: 36, lon0: 139 + 50 / 60 },
  { code: 10, lat0: 40, lon0: 140 + 50 / 60 },
  { code: 11, lat0: 44, lon0: 140.25 },
  { code: 12, lat0: 44, lon0: 142.25 },
  { code: 13, lat0: 44, lon0: 144.25 },
  { code: 14, lat0: 26, lon0: 142 },
  { code: 15, lat0: 26, lon0: 127.5 },
  { code: 16, lat0: 26, lon0: 124 },
  { code: 17, lat0: 26, lon0: 131 },
  { code: 18, lat0: 20, lon0: 136 },
  { code: 19, lat0: 26, lon0: 154 },
];

const ROMAN_SYSTEMS = new Map([
  ["I", 1],
  ["II", 2],
  ["III", 3],
  ["IV", 4],
  ["V", 5],
  ["VI", 6],
  ["VII", 7],
  ["VIII", 8],
  ["IX", 9],
  ["X", 10],
  ["XI", 11],
  ["XII", 12],
  ["XIII", 13],
  ["XIV", 14],
  ["XV", 15],
  ["XVI", 16],
  ["XVII", 17],
  ["XVIII", 18],
  ["XIX", 19],
]);

const toHalfWidthDigits = (value: string) =>
  value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );

const inferCoordinateSystem = (value?: string) => {
  if (!value) return undefined;
  const normalized = toHalfWidthDigits(value).toUpperCase();
  const digitMatch = /(?:第)?\s*(1[0-9]|[1-9])\s*(?:系|KEI)?/.exec(normalized);
  const digit = digitMatch?.[1] ? Number(digitMatch[1]) : undefined;
  if (digit && digit >= 1 && digit <= 19) return digit;

  for (const [roman, code] of [...ROMAN_SYSTEMS.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (normalized.includes(roman)) return code;
  }
  return undefined;
};

for (const system of PLANE_COORDINATE_SYSTEMS) {
  proj4.defs(
    `JPRCS:${system.code}`,
    `+proj=tmerc +lat_0=${system.lat0} +lon_0=${system.lon0} +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs`,
  );
}

function toLngLat(point: Coordinate, systemCode: number): [number, number] {
  // 測量座標は X=北方向、Y=東方向。proj4の横メルカトルは [easting, northing] で渡す。
  const [lng, lat] = proj4(`JPRCS:${systemCode}`, "EPSG:4326", [
    point.y,
    point.x,
  ]);
  return [lng, lat];
}

function SurveyMapPreview({ data }: { data: SurveyData }) {
  const inferredSystem = inferCoordinateSystem(
    data.survey_metadata.coordinate_system,
  );
  const [selectedSystem, setSelectedSystem] = useState(inferredSystem ?? 9);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    setSelectedSystem(inferredSystem ?? 9);
  }, [inferredSystem]);

  const geojson = useMemo(() => {
    const features = data.parcels
      .map((parcel, index) => {
        const ring = parcel.coordinates
          .filter(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          )
          .map((point) => toLngLat(point, selectedSystem));

        if (ring.length < 3) return null;

        const first = ring[0]!;
        const last = ring[ring.length - 1]!;
        const coordinates =
          first[0] === last[0] && first[1] === last[1]
            ? ring
            : [...ring, first];

        return {
          type: "Feature" as const,
          properties: {
            parcelId: parcel.parcel_id,
            color: PREVIEW_COLORS[index % PREVIEW_COLORS.length]!.stroke,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [coordinates],
          },
        };
      })
      .filter(
        (feature): feature is NonNullable<typeof feature> => feature !== null,
      );

    const pointFeatures = data.parcels.flatMap((parcel, parcelIndex) =>
      parcel.coordinates
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({
          type: "Feature" as const,
          properties: {
            point: point.point,
            color: PREVIEW_COLORS[parcelIndex % PREVIEW_COLORS.length]!.stroke,
          },
          geometry: {
            type: "Point" as const,
            coordinates: toLngLat(point, selectedSystem),
          },
        })),
    );

    return {
      type: "FeatureCollection" as const,
      features: [...features, ...pointFeatures],
    };
  }, [data.parcels, selectedSystem]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: "raster",
            tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
          },
        },
        layers: [{ id: "gsi", type: "raster", source: "gsi" }],
      },
      center: [139.767, 35.681],
      zoom: 16,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateData = () => {
      const existingSource = map.getSource<GeoJSONSource>("survey-map");
      if (existingSource) {
        existingSource.setData(geojson);
      } else {
        map.addSource("survey-map", { type: "geojson", data: geojson });
        map.addLayer({
          id: "survey-fill",
          type: "fill",
          source: "survey-map",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.28,
          },
        });
        map.addLayer({
          id: "survey-outline",
          type: "line",
          source: "survey-map",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
          },
        });
        map.addLayer({
          id: "survey-points",
          type: "circle",
          source: "survey-map",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": 5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "survey-point-labels",
          type: "symbol",
          source: "survey-map",
          filter: ["==", ["geometry-type"], "Point"],
          layout: {
            "text-field": ["get", "point"],
            "text-offset": [0.7, -0.7],
            "text-size": 12,
            "text-anchor": "bottom-left",
          },
          paint: {
            "text-color": "#111827",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }

      const coordinates = geojson.features.flatMap((feature) => {
        if (feature.geometry.type === "Point")
          return [feature.geometry.coordinates];
        return feature.geometry.coordinates.flat();
      });

      if (coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (nextBounds, coordinate) => nextBounds.extend(coordinate),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
        );
        map.fitBounds(bounds, {
          padding: 72,
          maxZoom: 20,
          duration: 400,
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateData();
    } else {
      void map.once("load", updateData);
    }
  }, [geojson]);

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            地図プレビュー
          </h2>
          {inferredSystem && (
            <p className="mt-1 text-xs text-gray-400">
              OCR推定: 第{inferredSystem}系
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          座標系
          <select
            value={selectedSystem}
            onChange={(event) => setSelectedSystem(Number(event.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            {PLANE_COORDINATE_SYSTEMS.map((system) => (
              <option key={system.code} value={system.code}>
                第{system.code}系
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={mapContainerRef}
        className="h-[420px] overflow-hidden rounded-lg border border-gray-100"
      />
    </section>
  );
}

function SurveyShapePreview({ data }: { data: SurveyData }) {
  const width = 720;
  const height = 420;
  const padding = 42;
  const allPoints = [
    ...data.parcels.flatMap((parcel) => parcel.coordinates),
    ...data.reference_points,
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (allPoints.length === 0) {
    return null;
  }

  // 測量座標は X=北方向、Y=東方向。画面では上を北にして Yを横軸、Xを縦軸へ写す。
  const minEast = Math.min(...allPoints.map((point) => point.y));
  const maxEast = Math.max(...allPoints.map((point) => point.y));
  const minNorth = Math.min(...allPoints.map((point) => point.x));
  const maxNorth = Math.max(...allPoints.map((point) => point.x));
  const eastRange = Math.max(maxEast - minEast, 1);
  const northRange = Math.max(maxNorth - minNorth, 1);
  const scale = Math.min(
    (width - padding * 2) / eastRange,
    (height - padding * 2) / northRange,
  );
  const drawingWidth = eastRange * scale;
  const drawingHeight = northRange * scale;
  const offsetX = (width - drawingWidth) / 2;
  const offsetY = (height - drawingHeight) / 2;
  const pointRadius = Math.max(3, Math.min(6, scale * 0.03));
  const labelOffset = Math.max(10, pointRadius * 2.4);

  const toScreen = (point: Coordinate) => ({
    x: offsetX + (point.y - minEast) * scale,
    y: offsetY + (maxNorth - point.x) * scale,
  });

  const parcelPaths = data.parcels.map((parcel, index) => {
    const points = parcel.coordinates
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map(toScreen);
    const path =
      points.length > 0
        ? `${points.map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")} Z`
        : "";
    const color = PREVIEW_COLORS[index % PREVIEW_COLORS.length]!;
    return { parcel, path, points, color };
  });
  const previewLabels = placePreviewLabels({
    items: [
      ...data.parcels.flatMap((parcel) => {
        return parcel.coordinates
          .filter(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          )
          .map((point) => {
            const screen = toScreen(point);
            return {
              key: `parcel-${parcel.parcel_id}-${point.point}-${point.x}-${point.y}`,
              text: point.point,
              pointX: screen.x,
              pointY: screen.y,
              fill: "#111827",
              fontSize: 14,
              fontWeight: 700,
            };
          });
      }),
      ...data.reference_points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => {
          const screen = toScreen(point);
          return {
            key: `ref-${point.point}-${point.x}-${point.y}`,
            text: point.point,
            pointX: screen.x,
            pointY: screen.y,
            fill: "#475569",
            fontSize: 13,
            fontWeight: 600,
          };
        }),
    ],
    width,
    height,
    padding,
    labelOffset,
  });

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
          図形プレビュー
        </h2>
        <span className="text-xs text-gray-400">北方向: 上</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-slate-50">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="抽出座標の図形プレビュー"
        >
          <rect width={width} height={height} fill="#f8fafc" />
          <g stroke="#e2e8f0" strokeWidth="1">
            {Array.from({ length: 9 }, (_, i) => {
              const x = (width / 8) * i;
              const y = (height / 8) * i;
              return (
                <g key={i}>
                  <line x1={x} y1="0" x2={x} y2={height} />
                  <line x1="0" y1={y} x2={width} y2={y} />
                </g>
              );
            })}
          </g>
          <g>
            {parcelPaths.map(({ parcel, path, color }) =>
              path ? (
                <path
                  key={parcel.parcel_id}
                  d={path}
                  fill={color.fill}
                  fillOpacity="0.62"
                  stroke={color.stroke}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </g>
          <g>
            {data.reference_points.map((point) => {
              if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
                return null;
              const screen = toScreen(point);
              return (
                <g key={`ref-${point.point}`}>
                  <circle
                    cx={screen.x}
                    cy={screen.y}
                    r={pointRadius}
                    fill="#64748b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
            {data.parcels.map((parcel, parcelIndex) =>
              parcel.coordinates.map((point) => {
                if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
                  return null;
                const screen = toScreen(point);
                const color =
                  PREVIEW_COLORS[parcelIndex % PREVIEW_COLORS.length]!;
                return (
                  <g
                    key={`${parcel.parcel_id}-${point.point}-${point.x}-${point.y}`}
                  >
                    <circle
                      cx={screen.x}
                      cy={screen.y}
                      r={pointRadius}
                      fill={color.stroke}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              }),
            )}
          </g>
          <g>
            {previewLabels.map((label) => (
              <g key={label.key}>
                <line
                  x1={label.pointX}
                  y1={label.pointY}
                  x2={label.x}
                  y2={label.y - label.fontSize / 2}
                  stroke={label.fill}
                  strokeOpacity="0.24"
                  strokeWidth="1"
                />
                <text
                  x={label.x}
                  y={label.y}
                  fill={label.fill}
                  fontSize={label.fontSize}
                  fontWeight={label.fontWeight}
                  textAnchor={label.textAnchor}
                  paintOrder="stroke"
                  stroke="#f8fafc"
                  strokeWidth="3"
                  strokeLinejoin="round"
                >
                  {label.text}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.parcels.map((parcel, index) => {
          const color = PREVIEW_COLORS[index % PREVIEW_COLORS.length]!;
          return (
            <span
              key={parcel.parcel_id}
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color.stroke }}
              />
              {parcel.parcel_id}
            </span>
          );
        })}
        {data.reference_points.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
            基準点
          </span>
        )}
      </div>
    </section>
  );
}

type Props = {
  result: SurveyData;
  imageUrl?: string;
  onSave?: (data: SurveyData) => void;
  isSaving?: boolean;
};

const isPdfUrl = (url: string) =>
  url.split("?")[0]?.toLowerCase().endsWith(".pdf") ?? false;

export function SurveyResult({ result, imageUrl, onSave, isSaving }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<SurveyData>(result);
  const [exporting, setExporting] = useState<
    "dxf" | "csv" | "xlsx" | "sima" | null
  >(null);

  const displayData = editMode ? editData : result;
  const totalArea = displayData.parcels
    .reduce((sum, p) => sum + p.area_m2, 0)
    .toFixed(2);
  const calculationMethod = getSurveyCalculationMethod(displayData);
  const hasCoordinates = hasAnyUsableCoordinates(displayData);
  const canExportSpatial =
    hasCoordinates && isCoordinateBasedSurvey(displayData);

  const handleExport = async (format: "dxf" | "csv" | "xlsx" | "sima") => {
    if ((format === "dxf" || format === "sima") && !canExportSpatial) {
      return;
    }
    setExporting(format);
    try {
      const res = await fetch(`/api/export-${format}`, {
        method: "POST",
        headers: {
          ...(Object.fromEntries(await getAuthHeaders()) as Record<
            string,
            string
          >),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(displayData),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${displayData.survey_metadata.location_id}.${format === "sima" ? "sim" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const handleEditStart = () => {
    setEditData(JSON.parse(JSON.stringify(result)) as SurveyData);
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  const handleSave = () => {
    onSave?.(editData);
    setEditMode(false);
  };

  const updateMeta = (field: string, value: string | number) => {
    setEditData((prev) => ({
      ...prev,
      survey_metadata: { ...prev.survey_metadata, [field]: value },
    }));
  };

  const updateParcelCoords = (parcelIdx: number, coords: Coordinate[]) => {
    setEditData((prev) => ({
      ...prev,
      parcels: prev.parcels.map((p, i) =>
        i === parcelIdx ? { ...p, coordinates: coords } : p,
      ),
    }));
  };

  const updateParcelArea = (parcelIdx: number, value: string) => {
    setEditData((prev) => ({
      ...prev,
      parcels: prev.parcels.map((p, i) =>
        i === parcelIdx ? { ...p, area_m2: parseFloat(value) || 0 } : p,
      ),
    }));
  };

  return (
    <div className="space-y-4">
      {/* 画像プレビュー（履歴詳細から開いた場合） */}
      {imageUrl && (
        <div className="flex items-start justify-between gap-4 rounded-xl bg-white p-4 shadow-sm">
          {isPdfUrl(imageUrl) ? (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-40 w-40 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            >
              <svg
                className="h-10 w-10 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.5L13.5 4H7a2 2 0 00-2 2v13a2 2 0 002 2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 4v6h6"
                />
              </svg>
              <span className="text-xs font-medium">PDFを開く</span>
            </a>
          ) : (
            <span className="relative block h-40 w-40 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={imageUrl}
                alt="地積測量図"
                fill
                unoptimized
                className="object-cover"
              />
            </span>
          )}
          <div className="flex flex-1 flex-col items-end gap-2">
            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              ファイルをダウンロード
            </a>
          </div>
        </div>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            出力
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["dxf", "csv", "xlsx", "sima"] as const).map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={
                  exporting !== null ||
                  ((format === "dxf" || format === "sima") && !canExportSpatial)
                }
                title={
                  (format === "dxf" || format === "sima") && !canExportSpatial
                    ? "座標がないため出力できません"
                    : undefined
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {exporting === format
                  ? "出力中..."
                  : `${format.toUpperCase()} 出力`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 編集アクションバー */}
      {onSave && (
        <div className="flex justify-end gap-2">
          {!editMode ? (
            <button
              onClick={handleEditStart}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              編集
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
            </>
          )}
        </div>
      )}

      {/* 基本情報 */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          基本情報
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {editMode ? (
            <>
              <MetaInput
                label="地番"
                value={editData.survey_metadata.location_id}
                onChange={(v) => updateMeta("location_id", v)}
              />
              <MetaItem label="地積合計" value={`${totalArea} ㎡`} />
              <MetaInput
                label="測量年月日"
                value={editData.survey_metadata.survey_date}
                onChange={(v) => updateMeta("survey_date", v)}
              />
              <MetaInput
                label="測地系"
                value={editData.survey_metadata.geodetic_system}
                onChange={(v) => updateMeta("geodetic_system", v)}
              />
              <MetaInput
                label="座標系"
                value={editData.survey_metadata.coordinate_system ?? ""}
                onChange={(v) => updateMeta("coordinate_system", v)}
              />
              <MetaInput
                label="縮尺係数"
                value={String(editData.survey_metadata.scale_factor)}
                onChange={(v) => updateMeta("scale_factor", parseFloat(v) || 1)}
              />
              <MetaInput
                label="測量士"
                value={editData.survey_metadata.surveyor ?? ""}
                onChange={(v) => updateMeta("surveyor", v)}
              />
              <MetaInput
                label="作成者"
                value={editData.survey_metadata.creator_organization ?? ""}
                onChange={(v) => updateMeta("creator_organization", v)}
              />
              <MetaInput
                label="申請人"
                value={editData.survey_metadata.applicant ?? ""}
                onChange={(v) => updateMeta("applicant", v)}
              />
              <MetaInput
                label="求積方式"
                value={methodLabel(calculationMethod)}
                onChange={() => undefined}
              />
            </>
          ) : (
            <>
              <MetaItem
                label="地番"
                value={result.survey_metadata.location_id}
              />
              <MetaItem label="地積合計" value={`${totalArea} ㎡`} />
              <MetaItem
                label="測量年月日"
                value={result.survey_metadata.survey_date}
              />
              <MetaItem
                label="測地系"
                value={result.survey_metadata.geodetic_system}
              />
              <MetaItem
                label="座標系"
                value={result.survey_metadata.coordinate_system ?? "—"}
              />
              <MetaItem
                label="縮尺係数"
                value={String(result.survey_metadata.scale_factor)}
              />
              <MetaItem
                label="求積方式"
                value={methodLabel(calculationMethod)}
              />
              <MetaItem
                label="座標状態"
                value={coordinateStatusLabel(
                  result.survey_metadata.coordinate_status,
                )}
              />
              {result.survey_metadata.surveyor && (
                <MetaItem
                  label="測量士"
                  value={result.survey_metadata.surveyor}
                />
              )}
              {result.survey_metadata.creator_organization && (
                <MetaItem
                  label="作成者"
                  value={result.survey_metadata.creator_organization}
                />
              )}
              {result.survey_metadata.applicant && (
                <MetaItem
                  label="申請人"
                  value={result.survey_metadata.applicant}
                />
              )}
            </>
          )}
        </div>
        {displayData.survey_metadata.method_evidence &&
          displayData.survey_metadata.method_evidence.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {displayData.survey_metadata.method_evidence.map((evidence) => (
                <span
                  key={evidence}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
                >
                  {evidence}
                </span>
              ))}
            </div>
          )}
      </section>

      <ValidationSummary data={displayData} />

      {canExportSpatial ? (
        <>
          <SurveyMapPreview data={displayData} />

          <SurveyShapePreview data={displayData} />
        </>
      ) : (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            図形・地図プレビュー
          </h2>
          <p className="text-sm text-gray-500">
            この図面は{methodLabel(calculationMethod)}
            として扱われています。座標表がないため、地図表示・図形復元・DXF/SIMA出力は対象外です。
          </p>
        </section>
      )}

      {/* 筆ごとの座標 */}
      {displayData.parcels.map((parcel, parcelIdx) => (
        <section
          key={parcel.parcel_id}
          className="rounded-xl bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              {parcel.parcel_id}
            </h2>
            {editMode ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={parcel.area_m2}
                  onChange={(e) => updateParcelArea(parcelIdx, e.target.value)}
                  className="w-28 rounded border border-blue-200 px-2 py-1 text-right text-sm font-semibold text-blue-700 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                />
                <span className="text-sm font-semibold text-blue-700">㎡</span>
              </div>
            ) : (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {parcel.area_m2} ㎡
              </span>
            )}
          </div>
          {editMode ? (
            <CoordTableEdit
              rows={parcel.coordinates}
              onChange={(coords) => updateParcelCoords(parcelIdx, coords)}
            />
          ) : parcel.coordinates.length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              座標表は読み取られていません。
              {parcel.calculation_method
                ? `${methodLabel(parcel.calculation_method)}として面積を表示しています。`
                : "面積のみを表示しています。"}
              {parcel.calculation_notes && (
                <p className="mt-1 text-blue-800">{parcel.calculation_notes}</p>
              )}
            </div>
          ) : (
            <CoordTable rows={parcel.coordinates} />
          )}
        </section>
      ))}

      {/* 隣接地番 */}
      {displayData.adjacent_parcels.length > 0 && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            隣接地番
          </h2>
          <div className="flex flex-wrap gap-2">
            {displayData.adjacent_parcels.map((p) => (
              <span
                key={p}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 基準点 */}
      {displayData.reference_points.length > 0 && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            基準点
          </h2>
          {editMode ? (
            <CoordTableEdit
              rows={editData.reference_points}
              onChange={(coords) =>
                setEditData((prev) => ({ ...prev, reference_points: coords }))
              }
            />
          ) : (
            <CoordTable rows={result.reference_points} />
          )}
        </section>
      )}
    </div>
  );
}
