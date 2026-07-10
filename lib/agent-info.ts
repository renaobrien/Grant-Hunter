// One place that says what each agent is, what model it runs on, and what it
// costs. Rendered by the Runs page info panel; docs/AGENTS.md carries the same
// table for the repo. Keys match the agent_type values written to agent_runs.
// Costs are estimates at list price after the 2026-07 cost-control bounds
// (finder 4 searches, skeptic 4 searches); a discovery run is 2 rounds by
// default, so finder/skeptic/judge each run up to twice per run.

export interface AgentInfoEntry {
  label: string;
  role: string;
  model: string;
  searches: string;
  cost: string;
}

export const AGENT_INFO: Record<string, AgentInfoEntry> = {
  finder: {
    label: "Finder",
    role: "Searches the live web and proposes grant candidates",
    model: "Sonnet",
    searches: "up to 4 (3 in fast mode)",
    cost: "~$0.70/run (based on 4 searches x 2 rounds)",
  },
  skeptic: {
    label: "Skeptic",
    role: "Tries to refute each candidate on the funder's own pages",
    model: "Opus (Sonnet in fast mode)",
    searches: "up to 4 (3 in fast mode)",
    cost: "~$0.90/run (based on 4 searches x 2 rounds)",
  },
  judge: {
    label: "Judge",
    role: "Reconciles Finder vs Skeptic, scores fit and alignment",
    model: "Opus",
    searches: "none",
    cost: "~$0.25/run (2 rounds)",
  },
  drafter: {
    label: "Drafter",
    role: "Writes application drafts",
    model: "Opus",
    searches: "none",
    cost: "~$0.15 per use",
  },
  critic: {
    label: "Critic",
    role: "Reviews and scores drafts",
    model: "Opus",
    searches: "none",
    cost: "~$0.10 per use",
  },
  requirements: {
    label: "Requirements",
    role: "Extracts application requirements from a grant page",
    model: "Sonnet",
    searches: "none",
    cost: "~$0.05 per use",
  },
  distiller: {
    label: "Preference distiller",
    role: "Distills your ratings into guidance the agents read",
    model: "Haiku",
    searches: "none",
    cost: "~$0.01 per use",
  },
};
