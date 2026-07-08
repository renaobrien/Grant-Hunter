// Runs page — read-only history of agent_runs (discovery, drafting, etc.).
// Server Component. No PAT, no GitHub API calls: manual runs are triggered by
// the operator from the repo's GitHub Actions tab.
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, EmptyState, type ChipTone } from "@/components/ui";
import type { AgentRunRow, AgentRunStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<AgentRunStatus, ChipTone> = {
  running: "info",
  success: "good",
  error: "bad",
};

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  running: "Running",
  success: "Success",
  error: "Error",
};

// Deterministic (UTC, fixed locale) so server render never depends on the host
// timezone. e.g. "Jul 7, 2026, 12:04 PM".
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatStarted(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DATE_FMT.format(d)} UTC`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = ms / 1000;
  return s >= 100 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}

function formatTokens(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function formatCost(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function truncate(text: string | null, max = 90): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export default async function RunsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select(
      "id, agent_type, trigger_type, status, started_at, duration_ms, tokens_used, cost_cents, error_message",
    )
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const runs = (data ?? []) as AgentRunRow[];

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Runs</h1>
      </div>

      <Card className="note-panel">
        <h3>Run discovery now</h3>
        <p>
          To find grants on demand, run <code>npm run discover</code> on the
          computer where you set this up. If you chose cloud runs during setup,
          you can also trigger <code>Weekly grant discovery</code> from your
          repository&apos;s GitHub Actions tab.
        </p>
      </Card>

      {error ? (
        <Card>
          <p className="muted">
            Couldn&apos;t load runs: {error.message}
          </p>
        </Card>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          hint="Trigger discovery from GitHub Actions to see run history here."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Started</th>
                <th className="num">Duration</th>
                <th className="num">Tokens</th>
                <th className="num">Cost</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const status = run.status as AgentRunStatus;
                const tone = STATUS_TONE[status] ?? "neutral";
                const label = STATUS_LABEL[status] ?? status;
                return (
                  <tr key={run.id}>
                    <td className="nowrap">{run.agent_type}</td>
                    <td className="nowrap">
                      <span className="muted">{run.trigger_type}</span>
                    </td>
                    <td>
                      <Chip label={label} tone={tone} />
                    </td>
                    <td className="nowrap">{formatStarted(run.started_at)}</td>
                    <td className="num">{formatDuration(run.duration_ms)}</td>
                    <td className="num">{formatTokens(run.tokens_used)}</td>
                    <td className="num">{formatCost(run.cost_cents)}</td>
                    <td className="cell-error">
                      {run.error_message ? (
                        <span title={run.error_message}>
                          {truncate(run.error_message)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
