// Refreshes the Supabase session on every request and gates the app: any
// unauthenticated request to a non-public path is redirected to /login.
// The cookie bridge writes refreshed tokens to BOTH the request (so the same
// request sees them) and the outgoing response (so the browser stores them).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  // No-login mode (local self-host): skip the entire auth gate — no /login,
  // no members check, no onboarding redirect. See AUTH_DISABLED in
  // lib/supabase/server.ts. Never enable this on a public host.
  if (process.env.AUTH_DISABLED === "true") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run any code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Members gate: a signed-in user whose email is not in the `members`
  // allowlist may only reach /no-access. RLS scopes the members table to the
  // caller (is_member()), so a non-member's lookup returns no row.
  if (user && !isPublic && pathname !== "/no-access") {
    const email = user.email?.toLowerCase() ?? "";
    const { data: member } = await supabase
      .from("members")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!member) {
      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      return NextResponse.redirect(url);
    }
  }

  // Onboarding gate: a member whose instance hasn't finished setup is sent to
  // /onboarding first. A missing profile row (fresh instance) counts as not
  // done. Wrapped so a pre-migration DB never hard-locks the whole app.
  if (
    user &&
    !isPublic &&
    pathname !== "/onboarding" &&
    pathname !== "/no-access"
  ) {
    try {
      const { data: profile } = await supabase
        .from("profile")
        .select("onboarding_complete")
        .eq("id", 1)
        .maybeSingle();
      if (!profile?.onboarding_complete) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    } catch {
      // DB/table not ready — don't trap the user; let the page handle it.
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|auth).*)"],
};
