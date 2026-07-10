// Warns when the profile is missing the facts the Skeptic needs to confirm
// eligibility (entity type, jurisdiction). Without them, every candidate is
// unverifiable and strong grants die - observed live as $30 of runs with an
// empty board. Server component; renders nothing when the profile is complete
// or unreadable.
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

const missing = (v: unknown): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  return !s || s.includes("not stated") || s === "unknown" || s === "n/a";
};

export default async function ProfileGapsNotice() {
  let gaps: string[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile")
      .select("entity_type, jurisdiction")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return null;
    if (missing(data.entity_type)) gaps.push("entity type (nonprofit, company, unincorporated…)");
    if (missing(data.jurisdiction)) gaps.push("jurisdiction (country / state of registration)");
  } catch {
    return null;
  }
  if (!gaps.length) return null;

  return (
    <Card className="note-panel">
      <h3>Your profile is missing {gaps.length === 1 ? "a fact" : "facts"} the fact-checker needs</h3>
      <p style={{ marginBottom: 0 }}>
        Not set: <strong>{gaps.join(" and ")}</strong>. Funders decide
        eligibility on exactly these, so the Skeptic can&rsquo;t confirm any
        grant without them and strong candidates get cut as unverifiable. Two
        minutes under <a href="/profile">Profile</a> fixes it - rejections made
        against the incomplete profile are retried automatically after you
        save.
      </p>
    </Card>
  );
}
