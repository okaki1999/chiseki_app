"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
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

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveMap = api.surveyMap.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      setShowSaveDialog(false);
    },
    onError: (e) => setError(e.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMimeType(f.type);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(f);
    setResult(null);
    setError(null);
    setSaved(false);
    setSaveName("");
  };

  const handleExtract = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: imageBase64, mimeType }),
      });
      const data = await res.json() as SurveyData & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      setResult(data);
      setSaveName(data.survey_metadata.location_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleExportDXF = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export-dxf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("DXF生成に失敗しました");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.survey_metadata.location_id}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "DXF出力エラー");
    } finally {
      setExporting(false);
    }
  };

  const handleSave = () => {
    if (!result || !imageBase64) return;
    saveMap.mutate({
      name: saveName,
      imageBase64,
      imageMimeType: mimeType,
      extractedData: result,
    });
  };

  const totalArea = result?.parcels.reduce((sum, p) => sum + p.area_m2, 0).toFixed(2);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Zahyoc</h1>
            <p className="text-sm text-gray-500">地積測量図 OCR 解析</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              履歴
            </Link>
            {result && (
              <button
                onClick={handleExportDXF}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exporting ? "出力中..." : "DXF 出力"}
              </button>
            )}
            {result && !saved && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存
              </button>
            )}
            {saved && (
              <span className="text-sm font-medium text-green-600">✓ 保存済み</span>
            )}
          </div>
        </div>

        {/* 保存ダイアログ */}
        {showSaveDialog && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="mb-2 text-sm font-medium text-blue-800">名前を付けて保存</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="例: 中野区1374番1 平成31年"
                className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saveMap.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saveMap.isPending ? "保存中..." : "確定"}
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="mb-4 overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white transition hover:border-gray-300">
          <label htmlFor="file-input" className="block cursor-pointer p-8 text-center">
            {preview ? (
              <img src={preview} alt="preview" className="mx-auto max-h-72 rounded-lg object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-medium">地積測量図をアップロード</span>
                <span className="text-xs">JPG / PNG</span>
              </div>
            )}
          </label>
          <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {preview && (
          <button
            onClick={handleExtract}
            disabled={loading}
            className="mb-8 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "解析中..." : "解析する"}
          </button>
        )}

        {loading && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Gemini が図面を解析しています...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <div className="space-y-4">
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

            {result.parcels.map((parcel) => (
              <section key={parcel.parcel_id} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{parcel.parcel_id}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                    {parcel.area_m2} ㎡
                  </span>
                </div>
                <CoordTable rows={parcel.coordinates} />
              </section>
            ))}

            {result.adjacent_parcels.length > 0 && (
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">隣接地番</h2>
                <div className="flex flex-wrap gap-2">
                  {result.adjacent_parcels.map((p) => (
                    <span key={p} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{p}</span>
                  ))}
                </div>
              </section>
            )}

            {result.reference_points.length > 0 && (
              <section className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">基準点</h2>
                <CoordTable rows={result.reference_points} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
