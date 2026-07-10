# The agents: what runs, on what model, at what cost

Grant Hunter's discovery is an adversarial debate. Each round, a **Finder**
searches the live web and proposes candidates, a **Skeptic** tries to refute
each one on the funder's own pages, and a **Judge** reconciles the two and
scores what survives. Survivors pass a deterministic quality gate and a
dead-link check before reaching the board. A run does up to 2 rounds by
default and stops early once it has enough survivors.

Every agent call is logged to `agent_runs` with its estimated cost
(`cost_cents`). That ledger drives two spend caps: the **daily budget** and
the **per-run budget** (both under Settings, Discovery & budget). Before each
call, the engine checks that a worst-case call fits inside both; a call that
fails without usage data is billed a conservative worst-case floor, so
timeouts and network errors count against the caps instead of slipping past
them.

Set a third ceiling outside the app: a **monthly usage limit on your API key**
at [console.anthropic.com/settings/limits](https://console.anthropic.com/settings/limits).
Anthropic enforces that one, so your bill stays capped even if the app
misbehaves.

Want cheaper runs without touching code? Switch **Settings, Discovery speed**
to **Fast**: the Skeptic drops from Opus to Sonnet and both searchers use
smaller search budgets, roughly halving the cost of a run.

Costs below are estimates at Anthropic list price. Per-run figures assume the
default 2 rounds; a run that stops early costs less.

| Agent | What it does | Model | Web searches | Avg cost |
|---|---|---|---|---|
| Finder | Searches the live web, proposes grant candidates | Sonnet | up to 4 (3 in fast mode) | ~$0.70/run (based on 4 searches x 2 rounds) |
| Skeptic | Tries to refute each candidate on the funder's own pages | Opus (Sonnet in fast mode) | up to 4 (3 in fast mode) | ~$0.90/run (based on 4 searches x 2 rounds) |
| Judge | Reconciles Finder vs Skeptic, scores fit and alignment | Opus | none | ~$0.25/run (2 rounds) |
| Drafter | Writes application drafts | Opus | none | ~$0.15 per use |
| Critic | Reviews and scores drafts | Opus | none | ~$0.10 per use |
| Requirements | Extracts application requirements from a grant page | Sonnet | none | ~$0.05 per use |
| Profile compiler | Compiles your org profile into the agents' voice | Opus | none | ~$0.10 per use |
| Preference distiller | Distills your ratings into guidance the agents read | Haiku | none | ~$0.01 per use |
| URL prefill | Prefills onboarding from your website | Sonnet | none | ~$0.02 per use |

Where the money goes: Finder and Skeptic dominate a discovery run because web
search results are large and get re-sent to the model on every continuation
turn. Their search budgets are deliberately small, and each call carries a
hard 6-minute request timeout plus an abort tied to the run's 40-minute wall
clock.

The same table backs the "i" info button on the Runs page
(`lib/agent-info.ts`).
