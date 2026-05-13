import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";
import { STORAGE_BUCKET } from "~/lib/storage";

export { STORAGE_BUCKET };

export const getSupabase = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください",
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
};
