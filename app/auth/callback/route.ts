// Magic-link landing: Supabase redirects here with a `?code=...`. We exchange it
// for a session (writing cookies via the request-scoped client) and send the
// user to the board. Missing/invalid code falls back to /login.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "auth");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
