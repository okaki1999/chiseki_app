"use client";

import Link from "next/link";
import { use } from "react";
import { api } from "~/trpc/react";
import { type SurveyData } from "~/lib/dxf";
import { SurveyResult } from "~/app/_components/SurveyResult";
import { AppHeader } from "~/app/_components/AppHeader";

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = api.useUtils();
  const { data: record, isLoading } = api.surveyMap.getById.useQuery({ id });
  const updateMap = api.surveyMap.update.useMutation({
    onSuccess: () => void utils.surveyMap.getById.invalidate({ id }),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg
          className="h-6 w-6 animate-spin text-gray-400"
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
      </main>
    );
  }

  if (!record) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500">レコードが見つかりません</p>
        <Link href="/history" className="text-sm text-blue-600 hover:underline">
          履歴一覧に戻る
        </Link>
      </main>
    );
  }

  const data = record.extractedData as SurveyData;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <AppHeader
          title={record.name}
          subtitle={`保存日: ${new Date(record.createdAt).toLocaleDateString("ja-JP")}`}
        />

        {updateMap.isError && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            保存に失敗しました: {updateMap.error.message}
          </div>
        )}

        <SurveyResult
          result={data}
          imageUrl={record.imageUrl}
          onSave={(editedData) =>
            updateMap.mutate({ id, extractedData: editedData })
          }
          isSaving={updateMap.isPending}
        />
      </div>
    </main>
  );
}
