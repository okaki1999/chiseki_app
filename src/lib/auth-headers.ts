"use client";

import {
  getSupabaseBrowser,
  isSupabaseAuthConfigured,
} from "~/lib/supabase-browser";

export async function getAuthHeaders() {
  const headers = new Headers();
  if (!isSupabaseAuthConfigured()) return headers;

  const { data } = await getSupabaseBrowser().auth.getSession();
  if (data.session?.access_token) {
    headers.set("authorization", `Bearer ${data.session.access_token}`);
  }
  return headers;
}
