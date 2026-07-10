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
import { sweepStaleRuns, tailLog } from "@/lib/run-control";
import type { AgentRunRow, AgentRunStatus, DebateRow } from "@/lib/types";

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

function truncate(text: string | null, max = 90): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

function groupStatus(rows: AgentRunRow[]): AgentRunStatus {
  if (rows.some((r) => r.status === "running")) return "running";
  if (rows.some((r) => r.status === "error")) return "error";
  return "success";
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

      {logTail ? (
        <Card className="note-panel">
          <details open={hasRunning}>
            <summary>
              <h3 style={{ display: "inline", margin: 0 }}>Live run log</h3>{" "}
              <span className="muted">
                {hasRunning
                  ? "what the run is doing right now (updates every few seconds)"
                  : "output from the most recent run"}
              </span>
            </summary>
            <div className="table-wrap" style={{ marginTop: "var(--s3)" }}>
              <pre className="voice-preview" style={{ margin: 0, maxHeight: 320, overflow: "auto" }}>
                {logTail}
              </pre>
            </div>
          </details>
        </Card>
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
                // Label anything with a runId as a discovery run - even mid-run
                // when only the Finder row exists, so a lone "Running" isn't
                // mistaken for a stuck one-off.
                const grouped = group.runId != null;
                const rows = group.rows.map((run) => {
                  const status = run.status as AgentRunStatus;
                  const tone = STATUS_TONE[status] ?? "neutral";
                  const label = STATUS_LABEL[status] ?? status;
                  return (
                    <tr key={run.id}>
                      <td className="nowrap">
                        {grouped ? (
                          <span style={{ paddingLeft: "var(--s4)" }}>
                            {run.agent_type}
                          </span>
                        ) : (
                          run.agent_type
                        )}
                      </td>
                      <td className="nowrap">
                        <span className="muted">{run.trigger_type}</span>
                      </td>
                      <td>
                        <Chip label={label} tone={tone} />
                      </td>
                      <td className="nowrap">
                        <LocalTime iso={run.started_at} />
                      </td>
                      <td className="num">
                        {status === "running" ? (
                          <Elapsed since={run.started_at} />
                        ) : (
                          formatDuration(run.duration_ms)
                        )}
                      </td>
                      <td className="num">{formatTokens(run.tokens_used)}</td>
                      <td className="num">{formatCost(run.cost_cents)}</td>
                      <td className="cell-error">
                        {run.error_message ? (
                          <span title={run.error_message}>
                            {truncate(run.error_message)}
                          </span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                if (!grouped) return rows;
                const status = groupStatus(group.rows);
                const runningRow = group.rows.find((r) => r.status === "running");
                return (
                  <Fragment key={group.key}>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <td colSpan={7}>
                        <strong>Discovery run</strong>{" "}
                        <span className="muted">
                          · {group.rows.length} agent step
                          {group.rows.length === 1 ? "" : "s"}
                          {runningRow ? (
                            <>
                              {" "}
                              · running <strong>{runningRow.agent_type}</strong> for{" "}
                              <Elapsed since={runningRow.started_at} />
                            </>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <Chip
                          label={STATUS_LABEL[status]}
                          tone={STATUS_TONE[status]}
                        />
                      </td>
                    </tr>
                    {rows}
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
