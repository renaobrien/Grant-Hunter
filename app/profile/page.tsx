export const dynamic = "force-dynamic";

import type { ProfileRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const profile = (data as ProfileRow | null) ?? null;
  const voice = profile?.compiled_voice?.trim();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Organization profile</h1>
          <p className="muted">
            The white-label voice your agents speak in. Every field feeds the
            compiled prompt below.
          </p>
        </div>
      </div>

      <ProfileForm profile={profile} />

      <div className="card">
        <h2>Compiled voice</h2>
        <p className="muted">
          This is the exact prompt your agents read. Save to regenerate.
        </p>
        <pre className="voice-preview">
          {voice
            ? voice
            : "No compiled voice yet - fill in the profile above and click Save to generate it."}
        </pre>
      </div>
    </div>
  );
}
