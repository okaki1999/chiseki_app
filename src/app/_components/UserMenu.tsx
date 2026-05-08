"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "~/lib/supabase-browser";
import { api } from "~/trpc/react";

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const { data } = api.tenant.current.useQuery(undefined, {
    enabled: Boolean(email),
  });

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    void getSupabaseBrowser()
      .auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  const handleSignOut = async () => {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/settings"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        管理
      </Link>
      {data?.role === "SUPER_ADMIN" && (
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          全管理
        </Link>
      )}
      {email && (
        <span className="max-w-40 truncate text-xs text-gray-400">{email}</span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        ログアウト
      </button>
    </div>
  );
}
