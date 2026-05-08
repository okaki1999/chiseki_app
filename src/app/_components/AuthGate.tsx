"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  isSupabaseAuthConfigured,
  getSupabaseBrowser,
} from "~/lib/supabase-browser";

type AuthState = "checking" | "ready" | "missing-config";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("checking");
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) {
      setState("missing-config");
      return;
    }

    const supabase = getSupabaseBrowser();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session && !isLoginPage) {
        router.replace("/login");
        return;
      }
      if (data.session && isLoginPage) {
        router.replace("/");
        return;
      }
      setState("ready");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isLoginPage) {
        router.replace("/login");
        return;
      }
      if (session && isLoginPage) {
        router.replace("/");
        return;
      }
      setState("ready");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, router]);

  if (state === "missing-config") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">
            Supabase Auth が未設定です
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            .env に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY
            を設定してください。
          </p>
        </div>
      </main>
    );
  }

  if (state === "checking" && !isLoginPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </main>
    );
  }

  return children;
}
