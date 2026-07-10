# Roadmap

What's next for Grant Hunter, in priority order. Grounded in what real runs
taught us (see the 2026-07-10 cost-control rework in the commit history and
[AGENTS.md](AGENTS.md)). Each item names the user problem it solves, not just
the code it touches.

## Now (next up)

1. **Cost per survivor on the Runs page.** Spend is visible; value isn't. Show
   $/candidate-landed per run and a rolling average, so "was that run worth
   it?" has a number. Data already exists in `agent_runs` + `grants`.
2. **Persist fit-floor culls across runs.** Candidates the Finder self-scores
   below the fit floor are skipped in-run, but nothing remembers them, so a
   future run can pay to re-propose the same near-misses. Write them to
   `agent_debate` (or a small rejected-candidates store) so
   `loadRejectedLabels`-style exclusions cover them too.
3. **Run summary where the user looks.** After a run: what was found, what was
   cut and why, what it cost - as a card on the board and in the digest, not
   only in the log tail. Zero-survivor runs especially need to explain
   themselves.
4. **Ledger reconciliation.** Compare `agent_runs` recorded cost against the
   Anthropic Admin usage/cost API weekly; alert in the digest when drift
   exceeds ~15%. This is the tripwire that would have caught the original
   undercount in one day.

## Next

5. **Auto-degrade mid-run.** When a run crosses half its budget, drop the
   remaining calls to fast mode (Sonnet skeptic, smaller search budgets)
   instead of stopping. More results per dollar without touching a setting.
6. **Split the Finder** into a cheap search pass plus a no-tools JSON
   formatting pass - avoids re-sending grown search context on every
   continuation turn. Only if empty-result finder calls recur after the
   2026-07-10 prompt rework.
7. **First-run budget step in onboarding.** One screen: per-run, daily, and a
   monthly-limit checklist item linking to the Anthropic console. The console
   limit is the ceiling the app can't cross; users should set it before their
   first spend, not after their first surprise.
8. **Low-rating feedback into exclusions.** Grants rated 1-2 with a reason
   already teach the preference context; also feed their funders/programs into
   the Finder's exclusion list so paid searches stop resurfacing them.

## Later

9. **CHANGELOG + VERSION.** The in-app updater (Settings, Updates) pulls new
   code but can't tell the user what changed. A CHANGELOG surfaced in
   `UpdatePanel` closes that loop.
10. **Fix `npm run lint`.** `next lint` was removed in Next 16 and there's no
    eslint flat config; `tsc --noEmit` is the only gate today. Add
    `eslint.config.mjs` and wire the script.
11. **Gate backtesting on cost.** Extend `scripts/gate-backtest.ts` to replay
    historical `agent_debate` rows against proposed budget/search settings, so
    tuning cost knobs is data-driven instead of vibes.
12. **Multi-channel run alerts.** Push "run finished: N survivors, $X spent"
    through the existing notify dispatcher, so scheduled (GitHub Actions) runs
    are visible without opening the app.

## Recently shipped (2026-07-10)

Cost-control rework: per-run budget setting, worst-case pre-flight against the
daily cap, failure-floor cost recording, bounded API calls (retries, timeout,
continuations, abort deadline), Finder discovery-breadth prompt + in-code fit
culling, rounds that always finish, agents table in Settings and
[AGENTS.md](AGENTS.md), budget-blocked Start button that explains itself.
