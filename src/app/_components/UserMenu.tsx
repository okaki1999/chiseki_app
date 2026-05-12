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
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
      {email && (
        <span className="max-w-32 truncate text-xs text-gray-400 sm:max-w-40">
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-50"
      >
        ログアウト
      </button>
    </div>
  );
}
