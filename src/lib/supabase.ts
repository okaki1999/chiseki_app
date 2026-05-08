import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";

export const STORAGE_BUCKET = "survey-images";

export const getSupabase = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
};
