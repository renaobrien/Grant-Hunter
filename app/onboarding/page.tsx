import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RunMode } from "@/lib/types";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profile").select("onboarding_complete").eq("id", 1).maybeSingle(),
    supabase.from("settings").select("run_mode").eq("id", 1).maybeSingle(),
  ]);

  // Already onboarded → don't trap them here.
  if (profile?.onboarding_complete) redirect("/");

  return <OnboardingFlow initialMode={(settings?.run_mode as RunMode) ?? "github"} />;
}
