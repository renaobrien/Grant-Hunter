// Browser Supabase client for Client Components (rating buttons, forms, etc.).
// Anon key only; RLS enforces the `members` allowlist.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
