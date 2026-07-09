// env-file.ts - shared .env.local IO + Supabase project-ref derivation.
// Used by BOTH the CLI (`npm run setup`, via a relative import) and the web
// /connect wizard's server action. Node-only (fs) - never import from
// middleware (edge runtime) or client components. Deliberately no
// `import "server-only"`: that package throws under tsx and would break setup.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const ENV_PATH = ".env.local";

const envPath = () => resolve(process.cwd(), ENV_PATH);

/** Parse .env.local into a key/value map. Missing file -> empty map. */
export function readEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(envPath())) {
    for (const line of readFileSync(envPath(), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/** Serialize the map back to .env.local: known keys first, then any extras the
 * user added by hand, so a re-write never silently drops a variable. */
export function writeEnv(env: Record<string, string>) {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "APP_BASE_URL",
    "DAILY_BUDGET_USD",
  ];
  const extras = Object.keys(env).filter((k) => !keys.includes(k));
  const lines = [...keys, ...extras]
    .filter((k) => env[k] !== undefined && env[k] !== "")
    .map((k) => `${k}=${env[k]}`);
  writeFileSync(envPath(), lines.join("\n") + "\n");
}

const REF = /^[a-z0-9]{20}$/;

/**
 * Turn whatever the user pastes for their Supabase project into the real
 * origin, https://<ref>.supabase.co. People routinely paste the DASHBOARD url
 * (https://supabase.com/dashboard/project/<ref>) or just the bare 20-char ref -
 * both contain the ref, so we EXTRACT it instead of rejecting. A wrong origin
 * makes every auth/data call fetch HTML and fail with
 * "Unexpected token '<' ... is not valid JSON", so this must be exact.
 */
export function deriveProjectUrl(
  raw: string,
): { url?: string; error?: string; note?: string } {
  const input = raw.trim().replace(/\/+$/, "");
  if (!input) return { error: "Required." };
  if (REF.test(input)) return { url: `https://${input}.supabase.co`, note: "ref" };
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return {
      error:
        "Not a URL or a project ref. Paste your Project URL (https://yourref.supabase.co) or the 20-character ref.",
    };
  }
  const host = u.hostname.toLowerCase();
  // Already a project origin (...supabase.co) - use it as-is.
  if (host.endsWith(".supabase.co")) return { url: `https://${host}` };
  // Dashboard URL - pull the ref out of /project/<ref>.
  const fromPath = u.pathname.match(/project\/([a-z0-9]{20})/);
  if (fromPath) return { url: `https://${fromPath[1]}.supabase.co`, note: "dashboard" };
  return {
    error:
      "Couldn't find a project ref in that. Use Supabase -> Project Settings -> Project URL (ends in .supabase.co), or paste the 20-character ref.",
  };
}

/** The bare ref from a project origin URL, e.g. https://abc...xyz.supabase.co -> abc...xyz. */
export function refFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return REF.test(ref) ? ref : null;
  } catch {
    return null;
  }
}
