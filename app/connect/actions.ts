"use server";

// Server Actions for the first-run /connect wizard. These run on an instance
// that may have NO Supabase env at all, so every probe builds its client from
// the SUBMITTED values - never from process.env (empty until the env file is
// written and the dev server reloads it).
import { createClient } from "@supabase/supabase-js";
import { readEnv, writeEnv, deriveProjectUrl, refFromUrl } from "@/lib/env-file";

export type ConnectStatus = "ok" | "schema_missing" | "error";
export interface ConnectResult {
  status: ConnectStatus;
  message: string;
  ref?: string;
}

interface ProbeError {
  code?: string;
  message?: string;
}

// Classify a `profile` probe error. PostgREST >= 12.2 reports a missing table
// as 404 code PGRST205 ("Could not find the table 'public.profile' in the
// schema cache"); 42P01 is the raw Postgres undefined_table SQLSTATE that
// leaks through on older stacks. Match the message too, defensively.
function isSchemaMissing(e: ProbeError): boolean {
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    /schema cache|does not exist/i.test(e.message ?? "")
  );
}

function isBadKey(e: ProbeError): boolean {
  return (
    e.code === "PGRST301" ||
    /invalid api key|jwt|jws/i.test(e.message ?? "")
  );
}

async function probe(url: string, serviceKey: string): Promise<ConnectResult> {
  const ref = refFromUrl(url) ?? undefined;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await sb.from("profile").select("id").limit(1);
  if (!error) return { status: "ok", message: "Connected.", ref };
  if (isSchemaMissing(error)) {
    return {
      status: "schema_missing",
      message: "Connected, but the database tables don't exist yet.",
      ref,
    };
  }
  if (isBadKey(error)) {
    return {
      status: "error",
      message:
        "Connected to the project, but the service_role key was rejected. Copy it again from Project Settings (the 'secret' one, click Reveal).",
      ref,
    };
  }
  // postgrest-js swallows network failures into { message: "TypeError: fetch
  // failed", code: "" } - surface those as a reachability problem.
  return {
    status: "error",
    message: `Could not reach ${url} (${error.message}). Double-check the project ref.`,
    ref,
  };
}

export async function verifyAndSave(input: {
  refOrUrl: string;
  anonKey: string;
  serviceKey: string;
  anthropicKey?: string;
}): Promise<ConnectResult> {
  const derived = deriveProjectUrl(input.refOrUrl);
  if (!derived.url) {
    return { status: "error", message: derived.error ?? "Enter your project ref." };
  }
  const anon = input.anonKey.trim();
  const service = input.serviceKey.trim();
  if (!anon) return { status: "error", message: "The anon / publishable key is required." };
  if (!service) return { status: "error", message: "The service_role / secret key is required." };

  const result = await probe(derived.url, service);
  if (result.status === "error") return result;

  // Reachable (schema present or not) - persist so the app can boot.
  try {
    const env = readEnv();
    env.NEXT_PUBLIC_SUPABASE_URL = derived.url;
    env.SUPABASE_URL = derived.url;
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
    env.SUPABASE_SERVICE_ROLE_KEY = service;
    const anthropic = input.anthropicKey?.trim();
    if (anthropic) env.ANTHROPIC_API_KEY = anthropic;
    env.APP_BASE_URL = env.APP_BASE_URL || "http://localhost:3000";
    env.DAILY_BUDGET_USD = env.DAILY_BUDGET_USD || "5";
    writeEnv(env);
  } catch (e) {
    return {
      status: "error",
      message:
        "Couldn't write .env.local (read-only filesystem?). If you're on a host like Vercel, set the environment variables in the host's dashboard instead.",
      ref: result.ref,
    };
  }
  return result;
}

/** Re-probe after the user runs the SQL. Prefers creds kept in client state;
 * falls back to process.env (covers the post-reload case). */
export async function recheckSchema(input?: {
  refOrUrl?: string;
  serviceKey?: string;
}): Promise<ConnectResult> {
  let url = "";
  let service = "";
  if (input?.refOrUrl && input?.serviceKey) {
    const derived = deriveProjectUrl(input.refOrUrl);
    if (derived.url) {
      url = derived.url;
      service = input.serviceKey.trim();
    }
  }
  if (!url || !service) {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  }
  if (!url || !service) {
    return {
      status: "error",
      message: "No connection details yet - fill in the form above first.",
    };
  }
  return probe(url, service);
}
