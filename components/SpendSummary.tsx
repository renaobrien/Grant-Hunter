// Cost panel for the Runs page: today's spend vs the daily budget, plus rolling
// 7-day / 30-day / all-time totals from agent_runs.cost_cents. Server component;
// every query is wrapped so a fresh or not-yet-migrated instance degrades to
// placeholders instead of throwing.
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

const usd = (cents: number | null): string =>
  cents == null ? "-" : `$${(cents / 100).toFixed(2)}`;

interface Summary {
  today_cents: number;
  week_cents: number;
  month_cents: number;
  all_cents: number;
  run_count: number;
}

export default async function SpendSummary() {
  let s: Summary | null = null;
  let todayCents: number | null = null;
  let budgetUsd: number | null = null;
  let needsUpdate = false;

  try {
    const supabase = await createClient();
    const [summaryRes, todayRes, settingsRes] = await Promise.all([
      supabase.rpc("spend_summary"),
      supabase.rpc("spent_cents_today"),
      supabase.from("settings").select("daily_budget_usd").eq("id", 1).maybeSingle(),
    ]);

    if (summaryRes.error) {
      // spend_summary() ships in migration 0015 - an older instance won't have it
      // yet. Fall back to today-only from the long-standing spent_cents_today().
      needsUpdate = true;
    } else {
      const row = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
      s = (row as Summary) ?? null;
    }
    todayCents = todayRes.error ? null : Number(todayRes.data ?? 0);
    const b = settingsRes.data?.daily_budget_usd;
    budgetUsd = b == null ? null : Number(b);
  } catch {
    // Env/DB absent - render placeholders.
    return null;
  }

  const today = s ? s.today_cents : todayCents;
  const budgetCents = budgetUsd == null ? null : Math.round(budgetUsd * 100);
  const overToday = budgetCents != null && today != null && today > budgetCents;

  const stats: { label: string; value: string; tone?: string }[] = [
    {
      label: "Today",
      value: budgetCents != null ? `${usd(today)} / ${usd(budgetCents)}` : usd(today),
      tone: overToday ? "health-over" : undefined,
    },
    { label: "Last 7 days", value: s ? usd(s.week_cents) : "-" },
    { label: "Last 30 days", value: s ? usd(s.month_cents) : "-" },
    { label: "All time", value: s ? usd(s.all_cents) : "-" },
  ];

  return (
    <Card className="note-panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Spend</h3>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {s ? `across ${s.run_count} agent call${s.run_count === 1 ? "" : "s"}` : "AI cost from every run"}
        </span>
      </div>
      <div
        className="row"
        style={{ gap: "var(--s4)", flexWrap: "wrap", marginTop: "var(--s3)" }}
      >
        {stats.map((st) => (
          <div key={st.label} style={{ minWidth: 120 }}>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              {st.label}
            </div>
            <div className={st.tone} style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              {st.value}
            </div>
          </div>
        ))}
      </div>
      {needsUpdate ? (
        <p className="muted" style={{ margin: "var(--s3) 0 0", fontSize: "0.85rem" }}>
          Run the latest update (Settings -&gt; Updates) to unlock the 7-day,
          30-day, and all-time totals.
        </p>
      ) : null}
    </Card>
  );
}
