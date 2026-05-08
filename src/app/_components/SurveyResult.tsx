"use client";

import { useState } from "react";
import Image from "next/image";
import { type SurveyData, type Coordinate } from "~/lib/dxf";

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

const PREVIEW_COLORS = [
  { stroke: "#2563eb", fill: "#dbeafe" },
  { stroke: "#16a34a", fill: "#dcfce7" },
  { stroke: "#dc2626", fill: "#fee2e2" },
  { stroke: "#9333ea", fill: "#f3e8ff" },
  { stroke: "#0891b2", fill: "#cffafe" },
] as const;

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
                  <text
                    x={screen.x + labelOffset}
                    y={screen.y - labelOffset}
                    fill="#475569"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {point.point}
                  </text>
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
                    <text
                      x={screen.x + labelOffset}
                      y={screen.y - labelOffset}
                      fill="#111827"
                      fontSize="14"
                      fontWeight="700"
                    >
                      {point.point}
                    </text>
                  </g>
                );
              }),
            )}
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
  const [exporting, setExporting] = useState(false);

  const displayData = editMode ? editData : result;
  const totalArea = displayData.parcels
    .reduce((sum, p) => sum + p.area_m2, 0)
    .toFixed(2);

  const handleExportDXF = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export-dxf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(displayData),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${displayData.survey_metadata.location_id}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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
            <button
              onClick={handleExportDXF}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {exporting ? "出力中..." : "DXF 出力"}
            </button>
          </div>
        </div>
      )}

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
      </section>

      <SurveyShapePreview data={displayData} />

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
