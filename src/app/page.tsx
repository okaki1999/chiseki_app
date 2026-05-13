"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";
import { type SurveyData } from "~/lib/dxf";
import { getAuthHeaders } from "~/lib/auth-headers";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "~/lib/supabase-browser";
import { STORAGE_BUCKET } from "~/lib/storage";
import { SurveyResult } from "~/app/_components/SurveyResult";
import { AppHeader } from "~/app/_components/AppHeader";

type UploadedFile = {
  imageUrl: string;
  storagePath: string;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const readJsonResponse = async <T,>(res: Response): Promise<T> => {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
};

export default function Home() {
  const utils = api.useUtils();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const saveMap = api.surveyMap.create.useMutation({
    onSuccess: () => {
      setSaved(true);
      setShowSaveDialog(false);
    },
    onError: (e) => setError(e.message),
  });
  const { data: usageStatus } = api.tenant.usageStatus.useQuery(undefined, {
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      e.target.value = "";
      setFile(null);
      setPreview(null);
      setImageBase64(null);
      setFileName("");
      setResult(null);
      setSaved(false);
      setSaveName("");
      setUploadedFile(null);
      setError(
        "ファイルは8MBまでアップロードできます。PDFは対象ページだけにするか、ファイルを圧縮してください。",
      );
      return;
    }
    setFile(f);
    const selectedMimeType =
      f.type ||
      (f.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg");
    setMimeType(selectedMimeType);
    setFileName(f.name);
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
    setUploadedFile(null);
  };

  const uploadFileToStorage = async (selectedFile: File) => {
    const headers = Object.fromEntries(await getAuthHeaders()) as Record<
      string,
      string
    >;
    const signRes = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mimeType }),
    });
    const signed = await readJsonResponse<{
      path?: string;
      token?: string;
      publicUrl?: string;
      error?: string;
    }>(signRes);
    if (!signRes.ok || !signed.path || !signed.token || !signed.publicUrl) {
      throw new Error(signed.error ?? "アップロードURLの作成に失敗しました");
    }

    const uploadResult = (await getSupabaseBrowser()
      .storage.from(STORAGE_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, selectedFile)) as {
      error: { message: string } | null;
    };
    if (uploadResult.error) {
      throw new Error(
        `アップロードに失敗しました: ${uploadResult.error.message}`,
      );
    }

    const uploaded = {
      imageUrl: signed.publicUrl,
      storagePath: signed.path,
    };
    setUploadedFile(uploaded);
    return uploaded;
  };

  const handleExtract = async () => {
    if (!file && !imageBase64) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const uploaded =
        file && isSupabaseAuthConfigured()
          ? (uploadedFile ?? (await uploadFileToStorage(file)))
          : null;
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: {
          ...(Object.fromEntries(await getAuthHeaders()) as Record<
            string,
            string
          >),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          uploaded
            ? { storagePath: uploaded.storagePath, mimeType }
            : { base64: imageBase64, mimeType },
        ),
      });
      const data = await readJsonResponse<SurveyData & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      setResult(data);
      setSaveName(data.survey_metadata.location_id);
      await utils.tenant.usageStatus.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result || (!uploadedFile && !imageBase64)) return;
    saveMap.mutate({
      name: saveName,
      ...(uploadedFile
        ? { imageStoragePath: uploadedFile.storagePath }
        : { imageBase64: imageBase64 ?? undefined }),
      imageMimeType: mimeType,
      extractedData: result,
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <AppHeader
          title="地積測量図 OCR 解析"
          actions={[
            { href: "/history", label: "履歴" },
            ...(result && !saved
              ? [
                  {
                    label: "保存",
                    onClick: () => setShowSaveDialog(true),
                    variant: "primary" as const,
                  },
                ]
              : []),
          ]}
        >
          {saved && (
            <span className="text-sm font-medium text-green-600">
              ✓ 保存済み
            </span>
          )}
        </AppHeader>

        {/* 保存ダイアログ */}
        {showSaveDialog && (
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="mb-2 text-sm font-medium text-blue-800">
              名前を付けて保存
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="例: 中野区1374番1 平成31年"
                className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saveMap.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saveMap.isPending ? "保存中..." : "確定"}
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="rounded-lg px-4 py-2 text-sm whitespace-nowrap text-gray-500 hover:text-gray-700"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="mb-4 overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white transition hover:border-gray-300">
          <label
            htmlFor="file-input"
            className="block cursor-pointer p-5 text-center sm:p-8"
          >
            {preview && mimeType === "application/pdf" ? (
              <div className="flex flex-col items-center gap-3 text-gray-500">
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
                <span className="max-w-full truncate text-sm font-medium text-gray-700">
                  {fileName}
                </span>
                <span className="text-xs">
                  PDFを解析対象として読み込みました
                </span>
              </div>
            ) : preview ? (
              <span className="relative mx-auto block h-56 max-w-full sm:h-72">
                <Image
                  src={preview}
                  alt="preview"
                  fill
                  unoptimized
                  className="rounded-lg object-contain"
                />
              </span>
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <svg
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="text-sm font-medium">
                  地積測量図をアップロード
                </span>
                <span className="text-xs">JPG / PNG / PDF</span>
                {usageStatus && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                    {usageStatus.unlimited
                      ? "残り 無制限"
                      : `残り ${usageStatus.remaining} 回`}
                  </span>
                )}
              </div>
            )}
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {preview && (
          <button
            onClick={handleExtract}
            disabled={loading}
            className="mb-8 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "解析中..." : "解析する"}
          </button>
        )}

        {loading && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
            <svg
              className="h-4 w-4 animate-spin"
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
            解析中...
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && <SurveyResult result={result} />}
      </div>
    </main>
  );
}
