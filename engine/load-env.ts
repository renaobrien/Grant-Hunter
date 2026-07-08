// load-env.ts - minimal .env.local loader for the CLI entry points
// (onboard, discover, jobs).
//
// Why this exists: Next.js auto-loads .env.local, but plain `tsx`/`node` do NOT.
// Without this, `npm run onboard` (etc.) can't see the SUPABASE_URL / keys that
// `npm run setup` just wrote, and dies with "Missing SUPABASE_URL …" - even
// though the values are right there in .env.local.
//
// Rules:
//   • A real environment variable ALWAYS wins. GitHub Actions / production set
//     these directly and have no .env.local, so we never clobber them.
//   • A missing .env.local is fine (that's the CI case) - do nothing.
//
// Zero dependencies on purpose: this must run before anything else and never
// be the reason setup fails.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadEnvLocal(file = ".env.local"): void {
  if (loaded) return;
  loaded = true;

  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // real env wins

    let val = line.slice(eq + 1).trim();
    // strip a single layer of matching quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// Run on import, so a bare `import "./load-env";` at the top of an entry file is
// all that's needed.
loadEnvLocal();
