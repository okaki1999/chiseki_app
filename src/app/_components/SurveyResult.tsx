"use client";

import { useState } from "react";
import { type SurveyData, type Coordinate } from "~/lib/dxf";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

function CoordTable({ rows }: { rows: Coordinate[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-400">
          <th className="pb-2 pr-4 font-normal">測点</th>
          <th className="pb-2 pr-4 font-normal">X座標</th>
          <th className="pb-2 pr-4 font-normal">Y座標</th>
          <th className="pb-2 font-normal">境界標</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.point} className="border-b last:border-0">
            <td className="py-2 pr-4 font-mono font-semibold text-gray-700">{c.point}</td>
            <td className="py-2 pr-4 font-mono text-gray-600">{c.x.toFixed(3)}</td>
            <td className="py-2 pr-4 font-mono text-gray-600">{c.y.toFixed(3)}</td>
            <td className="py-2 text-gray-500">{c.marker_type ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Props = {
  result: SurveyData;
  imageUrl?: string;
};

export function SurveyResult({ result, imageUrl }: Props) {
  const [exporting, setExporting] = useState(false);
  const totalArea = result.parcels.reduce((sum, p) => sum + p.area_m2, 0).toFixed(2);

  const handleExportDXF = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export-dxf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.survey_metadata.location_id}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 画像プレビュー（履歴詳細から開いた場合） */}
      {imageUrl && (
        <div className="flex items-start justify-between gap-4 rounded-xl bg-white p-4 shadow-sm">
          <img
            src={imageUrl}
            alt="地積測量図"
            className="h-40 w-40 flex-shrink-0 rounded-lg object-cover"
          />
          <div className="flex flex-1 flex-col items-end gap-2">
            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              画像をダウンロード
            </a>
            <button
              onClick={handleExportDXF}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? "出力中..." : "DXF 出力"}
            </button>
          </div>
        </div>
      )}

      {/* 基本情報 */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">基本情報</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetaItem label="地番" value={result.survey_metadata.location_id} />
          <MetaItem label="地積合計" value={`${totalArea} ㎡`} />
          <MetaItem label="測量年月日" value={result.survey_metadata.survey_date} />
          <MetaItem label="測地系" value={result.survey_metadata.geodetic_system} />
          <MetaItem label="座標系" value={result.survey_metadata.coordinate_system ?? "—"} />
          <MetaItem label="縮尺係数" value={String(result.survey_metadata.scale_factor)} />
          {result.survey_metadata.surveyor && (
            <MetaItem label="測量士" value={result.survey_metadata.surveyor} />
          )}
          {result.survey_metadata.creator_organization && (
            <MetaItem label="作成者" value={result.survey_metadata.creator_organization} />
          )}
          {result.survey_metadata.applicant && (
            <MetaItem label="申請人" value={result.survey_metadata.applicant} />
          )}
        </div>
      </section>

      {/* 筆ごとの座標 */}
      {result.parcels.map((parcel) => (
        <section key={parcel.parcel_id} className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {parcel.parcel_id}
            </h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {parcel.area_m2} ㎡
            </span>
          </div>
          <CoordTable rows={parcel.coordinates} />
        </section>
      ))}

      {/* 隣接地番 */}
      {result.adjacent_parcels.length > 0 && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">隣接地番</h2>
          <div className="flex flex-wrap gap-2">
            {result.adjacent_parcels.map((p) => (
              <span key={p} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 基準点 */}
      {result.reference_points.length > 0 && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">基準点</h2>
          <CoordTable rows={result.reference_points} />
        </section>
      )}
    </div>
  );
}
