"use server";

// Start a discovery run from the dashboard. Local self-host only: we spawn the
// existing CLI entrypoint (engine/run-discovery.ts) as a detached process so it
// outlives this request; progress lands in `agent_runs`, which the Runs page
// and HealthHeader already render. On serverless hosts there is no long-lived
// process to detach - those keep the GitHub Actions path.
import { spawn } from "node:child_process";
import { createClient } from "@/lib/supabase/server";
import { resolveAnthropicKey } from "@/engine/db";

export type StartDiscoveryResult = { ok: true } | { ok: false; error: string };

export async function startDiscovery(): Promise<StartDiscoveryResult> {
  if (process.env.VERCEL) {
    return {
      ok: false,
      error:
        "This hosted instance can't run discovery in-process. Trigger it from your GitHub repo: Actions -> Weekly grant discovery -> Run workflow.",
    };
  }

  const supabase = await createClient();

  // Fail fast with a clear message instead of a background run that dies
  // silently before writing an agent_runs row.
  try {
    await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // One at a time. Discovery runs minutes and spends real credit.
  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  if (running) {
    return {
      ok: false,
      error: "A run is already in progress - watch it below. One at a time.",
    };
  }

  try {
    const child = spawn(
      "npx",
      ["tsx", "engine/run-discovery.ts", "--manual"],
      { cwd: process.cwd(), detached: true, stdio: "ignore" },
    );
    child.unref();
  } catch (e) {
    return { ok: false, error: `Couldn't start the run: ${(e as Error).message}` };
  }

  return { ok: true };
}
