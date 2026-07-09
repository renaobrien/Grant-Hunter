// /connect - first-run wizard: connect YOUR Supabase project from the browser.
// Replaces the CLI setup path (supabase login/link, db:push, npm run setup) for
// local self-hosters: clone -> npm install -> npm run dev -> this page.
//
// Excluded from the middleware matcher, so it renders even when no env exists.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { refFromUrl } from "@/lib/env-file";
import ConnectForm from "./ConnectForm";

export const dynamic = "force-dynamic";

function combinedMigrationsSql(): string | null {
  try {
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    if (!files.length) return null;
    return files
      .map((f) => `-- ==== ${f} ====\n\n${readFileSync(join(dir, f), "utf8").trim()}`)
      .join("\n\n");
  } catch {
    return null;
  }
}

export default async function ConnectPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // A login-walled (hosted) instance is configured by definition - never show
  // the wizard there.
  if (process.env.REQUIRE_LOGIN === "true") redirect("/");

  if (url && serviceKey) {
    // Env exists - the only reason to be here is missing tables.
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error } = await sb.from("profile").select("id").limit(1);
    if (!error) redirect("/");
    return (
      <div style={{ maxWidth: 720, margin: "48px auto" }}>
        <ConnectForm
          mode="schema"
          initialRef={refFromUrl(url) ?? ""}
          schemaSql={combinedMigrationsSql()}
        />
      </div>
    );
  }

  // No env yet. On a read-only host (Vercel), the form can't write files - the
  // env vars belong in the host's dashboard.
  if (process.env.VERCEL) {
    return (
      <div style={{ maxWidth: 720, margin: "48px auto" }}>
        <Card className="stack">
          <h1>Finish setup in your host&rsquo;s dashboard</h1>
          <p className="muted">
            This instance has no database configured. On a hosted platform the
            values live in the host&rsquo;s environment settings, not a file.
          </p>
          <p>
            In your host (e.g. Vercel: <strong>Project -&gt; Settings -&gt;
            Environment Variables</strong>) set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>SUPABASE_URL</code>,{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> and redeploy. Full steps:
            DEPLOY.md in the repo.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "48px auto" }}>
      <ConnectForm mode="form" schemaSql={combinedMigrationsSql()} />
    </div>
  );
}
