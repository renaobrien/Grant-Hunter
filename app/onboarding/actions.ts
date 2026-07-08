"use server";

// Server Actions for the web onboarding flow. Profile writes go through the
// request-scoped authed client (RLS enforces the members allowlist); the Claude
// compile uses the server-only ANTHROPIC_API_KEY.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderVoice } from "@/engine/render-profile";
import { compileProfile } from "@/engine/compile-profile";
import type { RunMode } from "@/lib/types";

export type CompileResult =
  | { ok: true; orgName: string | null; voice: string }
  | { ok: false; error: string };

/** Step 1: compile the interview answers into a profile + save it (not yet marked complete). */
export async function runOnboardingCompile(
  answers: Record<string, string>,
): Promise<CompileResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Missing ANTHROPIC_API_KEY — add it to .env.local and restart the app.",
    };
  }

  let profile;
  try {
    profile = await compileProfile(answers, apiKey);
  } catch (e) {
    return { ok: false, error: `Couldn't build your profile: ${(e as Error).message}` };
  }

  const voice = renderVoice(profile);
  const supabase = await createClient();
  const { error } = await supabase.from("profile").upsert(
    { id: 1, ...profile, compiled_voice: voice, compiled_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true, orgName: profile.org_name, voice };
}

/** Step 2: record how the org wants the engine to run. */
export async function saveRunMode(
  mode: RunMode,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, run_mode: mode }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Step 3: mark onboarding done so the gate stops redirecting here. */
export async function finishOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile")
    .upsert({ id: 1, onboarding_complete: true }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
