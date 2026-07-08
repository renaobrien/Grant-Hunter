// Service-role Supabase client — SERVER-ONLY. Bypasses RLS, so it must never be
// imported into a client component or a client-reachable code path. Used by
// Server Actions that need privileged writes (e.g. uploading a feedback
// screenshot to Storage). Mirrors engine/db.ts getServiceClient().
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for service client.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
