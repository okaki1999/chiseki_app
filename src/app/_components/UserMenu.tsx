"use client";

import { useEffect, useState } from "react";
import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "~/lib/supabase-browser";

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

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
