import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_COLUMNS,
  type GrantRow,
  type GrantStatus,
  type Recommendation,
} from "@/lib/types";
import { Chip, ScorePips, EmptyState, type ChipTone } from "@/components/ui";
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
  | "status"
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grants")
    .select(
      "id, funder, program_name, amount, deadline, fit_score, alignment_score, recommendation, status",
    )
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("date_added", { ascending: false });

  const grants = (data ?? []) as CardGrant[];

  const byStatus = new Map<GrantStatus, CardGrant[]>();
  for (const g of grants) {
    const list = byStatus.get(g.status);
    if (list) list.push(g);
    else byStatus.set(g.status, [g]);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">
            {grants.length} grant{grants.length === 1 ? "" : "s"} across the
            board
          </p>
        </div>
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load grants"
          hint={error.message}
        />
      ) : (
        <div className="board">
          {STATUS_COLUMNS.map((col) => {
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
                    <EmptyState
                      title="Nothing here yet"
                      hint={
                        col.key === "searched"
                          ? "Run discovery to fill this board (GitHub → Actions → Weekly grant discovery → Run workflow)."
                          : "Grants land here as they move through the pipeline."
                      }
                    />
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
                          <span>{formatDeadline(g.deadline)}</span>
                        </div>

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
