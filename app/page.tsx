import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_COLUMNS,
  type GrantRow,
  type GrantStatus,
  type Recommendation,
} from "@/lib/types";
import { Chip, ScorePips, EmptyState, type ChipTone } from "@/components/ui";
import { deadlinePassed, checkedAgo, daysUntilDeadline } from "@/lib/freshness";
import RunDiscoveryButton from "@/components/RunDiscoveryButton";
import ProfileGapsNotice from "@/components/ProfileGapsNotice";
import StopDiscoveryButton from "@/components/StopDiscoveryButton";
import HideClosedToggle from "@/components/HideClosedToggle";
import BoardAutoRefresh from "@/components/BoardAutoRefresh";
import StatusSelect from "./StatusSelect";

export const dynamic = "force-dynamic";

// Only the fields the board card needs.
type CardGrant = Pick<
  GrantRow,
  | "id"
  | "funder"
  | "program_name"
  | "amount"
  | "deadline"
  | "fit_score"
  | "alignment_score"
  | "recommendation"
  | "confidence"
  | "blockers"
  | "status"
  | "last_verified"
  | "human_score"
>;

const REC_TONE: Record<Recommendation, ChipTone> = {
  pursue: "good",
  maybe: "warn",
  pass: "muted",
};

const REC_LABEL: Record<Recommendation, string> = {
  pursue: "Pursue",
  maybe: "Maybe",
  pass: "Pass",
};

function formatDeadline(deadline: string | null): string {
  if (!deadline || deadline === "unknown") return "No deadline";
  if (deadline === "rolling") return "Rolling";
  return deadline;
}

export default async function BoardPage() {
  // "Hide Closed lane" collapses the Closed column so a long dead-pile stays out
  // of the way. Persisted in a cookie (set by HideClosedToggle) so it survives
  // reloads and navigation, unlike the old ?closed=hidden URL param.
  const hideClosed = (await cookies()).get("hide_closed")?.value === "1";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grants")
    .select(
      "id, funder, program_name, amount, deadline, fit_score, alignment_score, recommendation, confidence, blockers, status, last_verified, human_score",
    )
    .is("deleted_at", null)
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("date_added", { ascending: false });

  const grants = (data ?? []) as CardGrant[];
  // The in-app run button needs a long-lived machine (local/self-host).
  const canRunHere = !process.env.VERCEL;
  const { data: runningRow } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .limit(1)
    .maybeSingle();
  const hasRunning = Boolean(runningRow);

  const byStatus = new Map<GrantStatus, CardGrant[]>();
  for (const g of grants) {
    const list = byStatus.get(g.status);
    if (list) list.push(g);
    else byStatus.set(g.status, [g]);
  }

  // "Needs your attention" - a single glance at what to act on, for a one-operator
  // instance where these signals otherwise stay scattered across pages.
  const needRating = grants.filter(
    (g) => g.status === "found" && g.human_score == null,
  ).length;
  const dueSoon = grants.filter((g) => {
    if (g.status !== "found" && g.status !== "drafting") return false;
    const d = daysUntilDeadline(g.deadline);
    return d != null && d >= 0 && d <= 7;
  }).length;

  return (
    <div className="stack">
      <BoardAutoRefresh active={hasRunning} />
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">
            {grants.length} grant{grants.length === 1 ? "" : "s"} across the
            board
          </p>
        </div>
        <HideClosedToggle hidden={hideClosed} />
      </div>

      <ProfileGapsNotice />

      {needRating > 0 || dueSoon > 0 ? (
        <div className="attention-strip">
          <span className="attention-label">Needs your attention</span>
          {dueSoon > 0 ? (
            <Chip
              label={`${dueSoon} deadline${dueSoon === 1 ? "" : "s"} within 7 days`}
              tone="warn"
            />
          ) : null}
          {needRating > 0 ? (
            <Chip
              label={`${needRating} grant${needRating === 1 ? "" : "s"} awaiting your rating`}
              tone="info"
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="Couldn't load grants"
          hint={error.message}
        />
      ) : (
        <div className="board">
          {STATUS_COLUMNS.filter(
            (col) => !(hideClosed && col.key === "closed"),
          ).map((col) => {
            const items = col.statuses.flatMap(
              (s) => byStatus.get(s) ?? [],
            );
            return (
              <section key={col.key} className="board-col">
                <header className="board-col-head">
                  <span className="col-title">{col.label}</span>
                  <span className="col-count">{items.length}</span>
                </header>
                <div className="board-col-body">
                  {items.length === 0 ? (
                    col.key === "searched" ? (
                      <div className="stack" style={{ gap: "var(--s3)" }}>
                        <EmptyState
                          title="Nothing here yet"
                          hint={
                            canRunHere
                              ? hasRunning
                                ? "A discovery run is in progress - grants appear here as they land."
                                : "Run discovery and your agents will fill this board."
                              : 'Run discovery from your GitHub repo: Actions tab -> "Weekly grant discovery" -> "Run workflow".'
                          }
                        />
                        {canRunHere ? (
                          hasRunning ? (
                            <StopDiscoveryButton />
                          ) : (
                            <RunDiscoveryButton label="Find grants now" />
                          )
                        ) : null}
                      </div>
                    ) : (
                      <EmptyState
                        title="Nothing here yet"
                        hint="Grants land here as they move through the pipeline."
                      />
                    )
                  ) : (
                    items.map((g) => (
                      <Link
                        key={g.id}
                        href={`/grants/${g.id}`}
                        className="grant-card"
                      >
                        <div className="gc-funder">{g.funder}</div>
                        {g.program_name ? (
                          <div className="gc-program">{g.program_name}</div>
                        ) : null}

                        <div className="gc-meta">
                          {g.amount ? (
                            <span className="gc-amount">{g.amount}</span>
                          ) : null}
                          {deadlinePassed(g.deadline) ? (
                            <Chip label="Deadline passed" tone="bad" />
                          ) : (
                            <span>{formatDeadline(g.deadline)}</span>
                          )}
                        </div>

                        {checkedAgo(g.last_verified) ? (
                          <div className="gc-meta">
                            <span className="gc-checked muted">
                              {checkedAgo(g.last_verified)}
                            </span>
                          </div>
                        ) : null}

                        <div className="gc-meta">
                          <span className="gc-scores">
                            <span className="gc-score-label">Fit</span>
                            <ScorePips score={g.fit_score} />
                          </span>
                          <span className="gc-scores">
                            <span className="gc-score-label">Align</span>
                            <ScorePips score={g.alignment_score} />
                          </span>
                          {g.recommendation ? (
                            <Chip
                              label={REC_LABEL[g.recommendation]}
                              tone={REC_TONE[g.recommendation]}
                            />
                          ) : null}
                          {g.confidence === "low" || (g.blockers ?? "").trim() ? (
                            <span title={(g.blockers ?? "").trim() || "The agents flagged this as low confidence - check the details before investing time."}>
                              <Chip label="Verify first" tone="warn" />
                            </span>
                          ) : null}
                        </div>

                        <div className="gc-meta gc-status-row">
                          <StatusSelect id={g.id} status={g.status} />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
