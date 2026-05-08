import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export const STORAGE_BUCKET = "survey-images";
