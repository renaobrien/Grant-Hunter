// Refreshes the Supabase session on every request and gates the app: any
// unauthenticated request to a non-public path is redirected to /login.
// The cookie bridge writes refreshed tokens to BOTH the request (so the same
// request sees them) and the outgoing response (so the browser stores them).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
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

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|auth).*)"],
};
