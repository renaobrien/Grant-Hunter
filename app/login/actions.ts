"use server";

// Magic-link sign-in. Runs on the server with the request-scoped anon client so
// the redirect origin can come from APP_BASE_URL (falling back to the request
// host). No secrets reach the browser.
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: string };

async function resolveOrigin(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Signature matches React's useActionState: (prevState, formData) => nextState.
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return { status: "error", error: "Enter a valid email address." };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { status: "error", error: error.message };
  }
  return { status: "sent", email };
}
