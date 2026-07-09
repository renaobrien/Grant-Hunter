"use server";

// Server Actions for the web onboarding flow. Profile writes go through the
// request-scoped authed client (RLS enforces the members allowlist); the Claude
// compile uses the Anthropic key from Settings (falling back to the env var).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderVoice } from "@/engine/render-profile";
import { compileProfile } from "@/engine/compile-profile";
import { draftAnswersFromUrl } from "@/engine/prefill-from-url";
import { friendlyClaudeError } from "@/engine/anthropic";
import { resolveAnthropicKey } from "@/engine/db";
import type { RunMode } from "@/lib/types";

export type CompileResult =
  | { ok: true; orgName: string | null; voice: string }
  | { ok: false; error: string };

export type PrefillResult =
  | { ok: true; answers: Record<string, string> }
  | { ok: false; error: string };

/** Read the org's website and draft answers to pre-fill the onboarding form. */
export async function prefillFromUrl(url: string): Promise<PrefillResult> {
  const clean = url.trim();
  if (!/^https?:\/\/.+\..+/.test(clean)) {
    return { ok: false, error: "Enter a full website URL, like https://yourorg.org" };
  }
  const supabase = await createClient();
  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  try {
    const answers = await draftAnswersFromUrl(clean, apiKey);
    return { ok: true, answers };
  } catch (e) {
    return { ok: false, error: friendlyClaudeError(e) };
  }
}

/** Step 1: compile the interview answers into a profile + save it (not yet marked complete). */
export async function runOnboardingCompile(
  answers: Record<string, string>,
): Promise<CompileResult> {
  const supabase = await createClient();

  let apiKey: string;
  try {
    apiKey = await resolveAnthropicKey(supabase);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let profile;
  try {
    profile = await compileProfile(answers, apiKey);
  } catch (e) {
    return { ok: false, error: friendlyClaudeError(e) };
  }

  const voice = renderVoice(profile);
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
