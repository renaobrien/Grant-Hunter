import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RunMode } from "@/lib/types";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profile").select("onboarding_complete").eq("id", 1).maybeSingle(),
    supabase.from("settings").select("run_mode, anthropic_api_key").eq("id", 1).maybeSingle(),
  ]);

  // Already onboarded → don't trap them here.
  if (profile?.onboarding_complete) redirect("/");

  // Presence only - the key value never reaches the client. Mirror the engine's
  // resolveAnthropicKey(): dashboard (DB) first, env fallback. Without a key the
  // AI compile can't run, so onboarding must collect one (see the deadlock note
  // in OnboardingFlow) instead of pointing at a Settings page it can't reach.
  const hasKey =
    Boolean(settings?.anthropic_api_key) || Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  return (
    <OnboardingFlow
      initialMode={(settings?.run_mode as RunMode) ?? "github"}
      hasKey={hasKey}
    />
  );
}
