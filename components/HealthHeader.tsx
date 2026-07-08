// Thin health strip rendered under the nav on every page. Server component.
// Every query is wrapped so a fresh/empty instance renders "-" rather than
// throwing. Shows: last run (relative), today's spend vs budget, grants tracked.
import { createClient } from "@/lib/supabase/server";

function relativeTime(iso: string | null): string {
  if (!iso) return "-";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default async function HealthHeader() {
  let lastRun: string | null = null;
  let spentCents = 0;
  let budgetUsd: number | null = null;
  let grantCount: number | null = null;

  try {
    const supabase = await createClient();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayISO = startOfToday.toISOString();

    const [lastRunRes, runsRes, settingsRes, grantsRes] = await Promise.all([
      supabase
        .from("agent_runs")
        .select("started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("agent_runs")
        .select("cost_cents")
        .gte("started_at", todayISO),
      supabase.from("settings").select("daily_budget_usd").eq("id", 1).maybeSingle(),
      supabase.from("grants").select("id", { count: "exact", head: true }),
    ]);

    lastRun = lastRunRes.data?.started_at ?? null;
    spentCents = (runsRes.data ?? []).reduce(
      (sum, r) => sum + (r.cost_cents ?? 0),
      0,
    );
    const budgetRaw = settingsRes.data?.daily_budget_usd;
    budgetUsd = budgetRaw == null ? null : Number(budgetRaw);
    grantCount = grantsRes.count ?? null;
  } catch {
    // Env/DB absent (build time or fresh instance): fall through to placeholders.
  }

  const spentUsd = spentCents / 100;
  const spentStr = `$${spentUsd.toFixed(2)}`;
  const budgetStr = budgetUsd == null ? "-" : `$${budgetUsd.toFixed(2)}`;
  const overBudget = budgetUsd != null && spentUsd > budgetUsd;
  const grantStr = grantCount == null ? "-" : String(grantCount);

  return (
    <div className="health-bar">
      <span>
        <strong>Last run:</strong> {relativeTime(lastRun)}
      </span>
      <span className="health-sep">·</span>
      <span className={overBudget ? "health-over" : undefined}>
        <strong>Today:</strong> {spentStr} / {budgetStr}
      </span>
      <span className="health-sep">·</span>
      <span>
        <strong>{grantStr}</strong> grants tracked
      </span>
    </div>
  );
}
