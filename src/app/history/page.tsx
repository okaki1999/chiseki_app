"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "~/trpc/react";
import { type SurveyData } from "~/lib/dxf";
import { getAuthHeaders } from "~/lib/auth-headers";
import { AppHeader } from "~/app/_components/AppHeader";

const isPdfUrl = (url: string) =>
  url.split("?")[0]?.toLowerCase().endsWith(".pdf") ?? false;

export default function HistoryPage() {
  const { data: records, isLoading, refetch } = api.surveyMap.list.useQuery();
  const deleteMap = api.surveyMap.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExportFile = async (
    id: string,
    extractedData: unknown,
    locationId: string,
    format: "dxf" | "csv" | "xlsx" | "sima",
  ) => {
    setExportingId(`${id}-${format}`);
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
        body: JSON.stringify(extractedData),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${locationId}.${format === "sima" ? "sim" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <AppHeader
          title="Zahyoc"
          subtitle="解析履歴"
          actions={[{ href: "/", label: "新規解析", variant: "primary" }]}
        />

        {/* 一覧 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg
              className="h-5 w-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          </div>
        )}

        {!isLoading && records?.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center text-gray-400 shadow-sm">
            <p className="text-sm">保存済みの図面がありません</p>
            <Link
              href="/"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              図面を解析して保存する
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {records?.map((record: (typeof records)[number]) => {
            const data = record.extractedData as SurveyData;
            const totalArea = data.parcels
              .reduce((sum, p) => sum + p.area_m2, 0)
              .toFixed(2);
            const date = new Date(record.createdAt).toLocaleDateString("ja-JP");

            return (
              <div
                key={record.id}
                className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
              >
                {/* サムネイル */}
                <Link href={`/history/${record.id}`}>
                  {isPdfUrl(record.imageUrl) ? (
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-red-400 hover:opacity-80">
                      <svg
                        className="h-7 w-7"
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
                    </div>
                  ) : (
                    <span className="relative block h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg hover:opacity-80">
                      <Image
                        src={record.imageUrl}
                        alt={record.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </span>
                  )}
                </Link>

                {/* 情報 */}
                <Link
                  href={`/history/${record.id}`}
                  className="min-w-0 flex-1 hover:opacity-70"
                >
                  <p className="truncate font-semibold text-gray-800">
                    {record.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {data.survey_metadata.location_id}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{totalArea} ㎡</span>
                    <span>·</span>
                    <span>{data.survey_metadata.survey_date}</span>
                    <span>·</span>
                    <span>保存日: {date}</span>
                  </div>
                </Link>

                {/* アクション */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  {/* ファイルダウンロード */}
                  <a
                    href={record.imageUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                    title="ファイルをダウンロード"
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
                  </a>

                  {/* DXF出力 */}
                  <button
                    onClick={() =>
                      handleExportFile(
                        record.id,
                        record.extractedData,
                        data.survey_metadata.location_id,
                        "dxf",
                      )
                    }
                    disabled={exportingId === `${record.id}-dxf`}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    title="DXFを出力"
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
                  </button>

                  <button
                    onClick={() =>
                      handleExportFile(
                        record.id,
                        record.extractedData,
                        data.survey_metadata.location_id,
                        "csv",
                      )
                    }
                    disabled={exportingId === `${record.id}-csv`}
                    className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    title="CSVを出力"
                  >
                    CSV
                  </button>

                  <button
                    onClick={() =>
                      handleExportFile(
                        record.id,
                        record.extractedData,
                        data.survey_metadata.location_id,
                        "xlsx",
                      )
                    }
                    disabled={exportingId === `${record.id}-xlsx`}
                    className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    title="Excelを出力"
                  >
                    XLSX
                  </button>

                  <button
                    onClick={() =>
                      handleExportFile(
                        record.id,
                        record.extractedData,
                        data.survey_metadata.location_id,
                        "sima",
                      )
                    }
                    disabled={exportingId === `${record.id}-sima`}
                    className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    title="SIMAを出力"
                  >
                    SIMA
                  </button>

                  {/* 削除 */}
                  <button
                    onClick={() => {
                      if (confirm(`「${record.name}」を削除しますか？`)) {
                        deleteMap.mutate({ id: record.id });
                      }
                    }}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-red-50 hover:text-red-500"
                    title="削除"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
