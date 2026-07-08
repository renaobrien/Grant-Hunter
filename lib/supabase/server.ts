// Request-scoped Supabase client for Server Components, Server Actions, and
// Route Handlers. Uses the ANON key + the caller's cookies, so every query runs
// as the signed-in user and RLS enforces the `members` allowlist. NEVER use the
// service-role key on any client-reachable path.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Login is OFF by default. A local self-host runs as a single user with no
 * sign-in - a login wall on your own machine is just friction. `createClient()`
 * then uses the service-role key so pages/actions work without a session.
 *
 * Turn login ON only for a public host by setting REQUIRE_LOGIN=true (DEPLOY.md
 * does this). SECURITY: without it the whole app is open to anyone who can reach
 * it - fine for localhost, not for the internet.
 */
export function authDisabled(): boolean {
  // Explicit opt-in to login for hosting. AUTH_DISABLED=false also forces it on,
  // for anyone who set that earlier.
  if (process.env.REQUIRE_LOGIN === "true") return false;
  if (process.env.AUTH_DISABLED === "false") return false;
  return true;
}

export async function createClient(): Promise<SupabaseClient> {
  if (authDisabled()) {
    // Server-only (Server Components / Actions / Route Handlers). The
    // service-role key is never sent to the browser.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error(
        "No-login mode (AUTH_DISABLED=true) needs NEXT_PUBLIC_SUPABASE_URL and " +
          "SUPABASE_SERVICE_ROLE_KEY. Run `npm run setup`, or set them in .env.local " +
          "/ your host's environment variables.",
      );
    }
    return createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
