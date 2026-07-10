// Runs page - history of agent_runs (discovery, drafting, etc.) plus local
// start/stop controls (see app/runs/actions.ts). Hosted instances trigger
// runs from GitHub Actions instead.
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, EmptyState, type ChipTone } from "@/components/ui";
import RunDiscoveryButton from "@/components/RunDiscoveryButton";
import StopDiscoveryButton from "@/components/StopDiscoveryButton";
import LocalTime from "@/components/LocalTime";
import Elapsed from "@/components/Elapsed";
import BoardAutoRefresh from "@/components/BoardAutoRefresh";
import RunLog from "@/components/RunLog";
import SpendSummary from "@/components/SpendSummary";
import { sweepStaleRuns, tailLog } from "@/lib/run-control";
import type { AgentRunRow, DebateRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// A run's outcome, cleaned up for humans. A user cancel and a timeout are not
// "errors", so the history isn't a wall of red.
interface RunOutcome {
  label: string;
  tone: ChipTone;
}
function classifyRun(status: string, message: string | null): RunOutcome {
  if (status === "running") return { label: "Running", tone: "info" };
  if (status === "success") return { label: "Done", tone: "good" };
  const m = (message ?? "").toLowerCase();
  if (/stopped by user|cancel/.test(m)) return { label: "Canceled", tone: "neutral" };
  if (/marked stale|ceiling|timed out|timeout/.test(m)) return { label: "Timed out", tone: "warn" };
  return { label: "Error", tone: "bad" };
}

// Turn a raw error (which can be an entire 502 HTML page) into one short line.
// Canceled/timeout are conveyed by the chip, so they return null here. The full
// original still rides along in the row's title attribute.
function humanizeError(status: string, message: string | null): string | null {
  if (status !== "error" || !message) return null;
  const clean = message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (/stopped by user|cancel/i.test(clean)) return null;
  if (/marked stale|ceiling|timed out|timeout/i.test(clean)) return null;
  if (/502|bad gateway/i.test(clean))
    return "Provider returned 502 (busy). Retried, then gave up - try again later.";
  if (/503|service unavailable/i.test(clean)) return "Provider unavailable (503) - try again later.";
  if (/429|rate limit|overloaded/i.test(clean)) return "Rate limited by the provider - try again later.";
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  const s = ms / 1000;
  return s >= 100 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`;
}

function formatTokens(n: number | null): string {
  if (n == null) return "-";
  return n.toLocaleString("en-US");
}

function formatCost(cents: number | null): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

// One discovery run spawns several agent calls (finder, skeptic, judge per
// round). They share input_data.runId, so group them under one header.
interface RunGroup {
  key: string;
  runId: string | null;
  rows: AgentRunRow[];
}

function groupRuns(runs: AgentRunRow[]): RunGroup[] {
  const groups: RunGroup[] = [];
  const byRunId = new Map<string, RunGroup>();
  for (const run of runs) {
    const raw = run.input_data?.runId;
    const runId = typeof raw === "string" && raw ? raw : null;
    if (runId) {
      const existing = byRunId.get(runId);
      if (existing) {
        existing.rows.push(run);
        continue;
      }
      const group = { key: runId, runId, rows: [run] };
      byRunId.set(runId, group);
      groups.push(group);
    } else {
      groups.push({ key: run.id, runId: null, rows: [run] });
    }
  }
  return groups;
}

// The representative status + message for a whole run: a running step wins, then
// an errored step, else the run is done. Feeds classifyRun for one header chip.
function groupOutcome(rows: AgentRunRow[]): { status: string; message: string | null } {
  const running = rows.find((r) => r.status === "running");
  if (running) return { status: "running", message: null };
  const errored = rows.find((r) => r.status === "error");
  if (errored) return { status: "error", message: errored.error_message };
  return { status: "success", message: null };
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

export default async function RunsPage() {
  const supabase = await createClient();
  await sweepStaleRuns(supabase);

  const [{ data, error }, { data: cutsData }] = await Promise.all([
    supabase
      .from("agent_runs")
      .select(
        "id, agent_type, trigger_type, status, started_at, duration_ms, tokens_used, cost_cents, error_message, input_data",
      )
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("agent_debate")
      .select("id, created_at, candidate_key, finder_claim, skeptic_verdict, judge_ruling")
      .filter("judge_ruling->>survives", "eq", "false")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const runs = (data ?? []) as AgentRunRow[];
  const cuts = (cutsData ?? []) as DebateRow[];
  const groups = groupRuns(runs);
  const hasRunning = runs.some((r) => r.status === "running");
  // In-process runs need a long-lived machine (local/self-host), not serverless.
  const canRunHere = !process.env.VERCEL;
  // The run writes to a log file, not this terminal. Surface its tail so a live
  // run isn't a black box. Refreshes with the page via BoardAutoRefresh.
  const logTail = canRunHere ? tailLog(40) : null;

  return (
    <div className="stack">
      <BoardAutoRefresh active={hasRunning} />
      <div className="page-head">
        <h1>Runs</h1>
      </div>

      <SpendSummary />

      <Card className="note-panel">
        <h3>Run discovery now</h3>
        {canRunHere ? (
          hasRunning ? (
            <>
              <p>
                One discovery run is in progress. It runs up to a few rounds of
                Finder → Skeptic → Judge; the Finder searches the live web, which
                can take several minutes per round. New rows appear below as each
                agent finishes.
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                Want quicker, cheaper runs? Switch to <strong>Fast</strong> mode
                under Settings → Discovery.
              </p>
              <StopDiscoveryButton />
            </>
          ) : (
            <>
              <p>
                Sends your agents hunting for new grants that match your profile.
              </p>
              <RunDiscoveryButton />
              <p className="muted" style={{ marginTop: "var(--s3)", marginBottom: 0 }}>
                Prefer the terminal? <code>npm run discover</code> does the same
                thing.
              </p>
            </>
          )
        ) : (
          <p>
            This hosted instance runs discovery through GitHub: open your
            repo&apos;s Actions tab, pick <code>Weekly grant discovery</code>,
            and press <em>Run workflow</em>.
          </p>
        )}
      </Card>

      {canRunHere ? (
        <RunLog initialLog={logTail} initialRunning={hasRunning} />
      ) : null}

      {error ? (
        <Card>
          <p className="muted">
            Couldn&apos;t load runs: {error.message}
          </p>
        </Card>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          hint="Start one with the button above - run history shows up here."
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
              {groups.map((group) => {
                // A runId means a discovery run (finder/skeptic/judge). Its child
                // rows carry per-step metrics but no chip - the one chip lives on
                // the header, so there's never a wall of duplicate pills.
                const grouped = group.runId != null;
                const childRows = group.rows.map((run) => {
                  const errText = humanizeError(run.status, run.error_message);
                  const running = run.status === "running";
                  return (
                    <tr key={run.id}>
                      <td className="nowrap">
                        <span style={{ paddingLeft: grouped ? "var(--s4)" : 0 }}>
                          {run.agent_type}
                        </span>
                      </td>
                      <td className="nowrap">
                        <span className="muted">{run.trigger_type}</span>
                      </td>
                      <td className="nowrap">
                        {grouped ? (
                          <span className="muted" style={{ fontSize: "0.85rem" }}>
                            {classifyRun(run.status, run.error_message).label.toLowerCase()}
                          </span>
                        ) : (
                          (() => {
                            const c = classifyRun(run.status, run.error_message);
                            return <Chip label={c.label} tone={c.tone} />;
                          })()
                        )}
                      </td>
                      <td className="nowrap">
                        <LocalTime iso={run.started_at} />
                      </td>
                      <td className="num">
                        {running ? (
                          <Elapsed since={run.started_at} />
                        ) : (
                          formatDuration(run.duration_ms)
                        )}
                      </td>
                      <td className="num">{formatTokens(run.tokens_used)}</td>
                      <td className="num">{formatCost(run.cost_cents)}</td>
                      <td className="cell-error">
                        {errText ? (
                          <span title={run.error_message ?? undefined}>{errText}</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                if (!grouped) return childRows;
                const outcome = groupOutcome(group.rows);
                const cls = classifyRun(outcome.status, outcome.message);
                const runningRow = group.rows.find((r) => r.status === "running");
                const firstStart =
                  group.rows[group.rows.length - 1]?.started_at ?? group.rows[0]?.started_at;
                return (
                  <Fragment key={group.key}>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <td colSpan={8}>
                        <span
                          className="row"
                          style={{ gap: "var(--s2)", alignItems: "baseline", flexWrap: "wrap" }}
                        >
                          <Chip label={cls.label} tone={cls.tone} />
                          <strong>Discovery run</strong>
                          <span className="muted">
                            <LocalTime iso={firstStart} />
                          </span>
                          {runningRow ? (
                            <span className="muted">
                              · {runningRow.agent_type} <Elapsed since={runningRow.started_at} />
                            </span>
                          ) : (
                            <span className="muted">
                              · {group.rows.length} step{group.rows.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                    {childRows}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cuts.length > 0 ? (
        <Card>
          <details className="cuts">
            <summary>
              <h3 style={{ display: "inline", margin: 0 }}>
                Recently cut candidates
              </h3>{" "}
              <span className="muted">
                {cuts.length} rejected by the Skeptic or Judge before reaching
                the board
              </span>
            </summary>
            <div className="stack" style={{ gap: "var(--s3)", marginTop: "var(--s3)" }}>
              {cuts.map((cut) => {
                const claim = cut.finder_claim ?? {};
                const skeptic = cut.skeptic_verdict ?? {};
                const judge = cut.judge_ruling ?? {};
                const funder = str(claim.funder) ?? cut.candidate_key ?? "Unknown candidate";
                const program = str(claim.program_name);
                const url = str(claim.application_url) ?? str(claim.source_url);
                const killShot = str(skeptic.kill_shot);
                const rationale = str(judge.notes) ?? str(judge.alignment_rationale);
                return (
                  <div key={cut.id} className="cut-item">
                    <div className="row" style={{ gap: "var(--s2)", alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {funder}
                            {program ? ` - ${program}` : ""} ↗
                          </a>
                        ) : (
                          <>
                            {funder}
                            {program ? ` - ${program}` : ""}
                          </>
                        )}
                      </strong>
                      <Chip label="Cut" tone="bad" />
                    </div>
                    {killShot ? <p style={{ margin: "var(--s1) 0 0" }}>{killShot}</p> : null}
                    {rationale ? (
                      <p className="muted" style={{ margin: "var(--s1) 0 0" }}>
                        {rationale}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
