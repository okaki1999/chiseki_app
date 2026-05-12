"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "~/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (result.error) throw result.error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ログイン</h1>
          <p className="mt-1 text-sm text-gray-500">
            管理者が発行したアカウントでログインしてください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              メールアドレス
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              パスワード
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>
      </div>
    </main>
  );
}
