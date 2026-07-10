// Entrypoint for the jobs runner. Two responsibilities per invocation:
//   PART A - drain the `jobs` work queue (currently: narrative_draft -> runDraft).
//   PART B - sweep tracked grants and fire deadline reminders at 14/7/3/1 days.
// Runs on the GitHub Actions cron ("*/30 * * * *") or locally via `npm run jobs`.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
//      (+ optional RESEND_API_KEY, TELEGRAM_BOT_TOKEN consumed by notify.ts).

import "./load-env"; // load .env.local into process.env (must be first)
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient, resolveAnthropicKey } from "./db";
import { runDraft } from "./draft";
import { sendNotification } from "./notify";
import { isHttp, urlAlive } from "./url-check";

interface JobRow {
  id: string;
  type: string;
  payload: { grant_id?: string } | null;
}

interface GrantDeadlineRow {
  id: string;
  funder: string | null;
  program_name: string | null;
  deadline: string | null;
  application_url: string | null;
  source_url: string | null;
  last_deadline_ping: string | null;
  status: string | null;
  human_score: number | null;
  rejection_reason: string | null;
}

const nowIso = () => new Date().toISOString();

/** Dispatch one job by type. Returns the value to store in jobs.result on success;
 *  throws to signal failure (the caller records it on the row). */
async function dispatchJob(sb: SupabaseClient, apiKey: string, job: JobRow): Promise<unknown> {
  if (job.type === "narrative_draft") {
    const grantId = job.payload?.grant_id;
    if (!grantId) throw new Error("narrative_draft job missing payload.grant_id");
    return await runDraft(sb, { apiKey, grantId, trigger: "scheduled" });
  }
  if (job.type === "refresh") {
    // On-demand URL re-validation (the sweep also runs every invocation below).
    return await sweepStaleLinks(sb);
  }
  throw new Error(`unknown job type: ${job.type}`);
}

/** PART A - claim up to 10 queued jobs (oldest first) and run each. One failure
 *  never aborts the loop; it's recorded on that job and we move on. */
async function runQueuedJobs(
  sb: SupabaseClient,
  apiKey: string,
): Promise<{ claimed: number; done: number; errored: number }> {
  const { data, error } = await sb
    .from("jobs")
    .select("id, type, payload")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) throw new Error(`could not load queued jobs: ${error.message}`);

  const jobs = (data ?? []) as JobRow[];
  let done = 0;
  let errored = 0;

  for (const job of jobs) {
    await sb.from("jobs").update({ status: "running", started_at: nowIso() }).eq("id", job.id);
    try {
      const result = await dispatchJob(sb, apiKey, job);
      await sb
        .from("jobs")
        .update({ status: "done", completed_at: nowIso(), result: result ?? null })
        .eq("id", job.id);
      done++;
    } catch (e) {
      await sb
        .from("jobs")
        .update({ status: "error", error: (e as Error).message, completed_at: nowIso() })
        .eq("id", job.id);
      errored++;
      console.error(`[jobs] job ${job.id} (${job.type}) failed: ${(e as Error).message}`);
    }
  }

  return { claimed: jobs.length, done, errored };
}

/** PART B - deadline sweep. Runs every invocation regardless of the queue.
 *  Fires 14/7/3/1-day reminders AND retires past-deadline grants so the board
 *  self-cleans instead of accumulating expired listings. */
async function sweepDeadlines(
  sb: SupabaseClient,
): Promise<{ scanned: number; pinged: number; expired: number }> {
  const { data, error } = await sb
    .from("grants")
    .select(
      "id, funder, program_name, deadline, application_url, source_url, last_deadline_ping, status, human_score, rejection_reason",
    )
    .in("status", ["found", "drafting"])
    .is("deleted_at", null)
    .not("deadline", "is", null);
  if (error) throw new Error(`could not load grants for deadline sweep: ${error.message}`);

  const grants = (data ?? []) as GrantDeadlineRow[];
  const today = nowIso().slice(0, 10); // YYYY-MM-DD (UTC)
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const MS_PER_DAY = 86_400_000;
  const MILESTONES = new Set([14, 7, 3, 1]);
  let pinged = 0;
  let expired = 0;

  const linkFor = (g: GrantDeadlineRow) =>
    isHttp(g.application_url) ? g.application_url : isHttp(g.source_url) ? g.source_url : "";

  for (const g of grants) {
    const raw = String(g.deadline ?? "").trim();
    // Only bare ISO calendar dates; 'rolling' / 'unknown' / free text are skipped.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue;
    const deadlineMs = Date.parse(`${raw}T00:00:00Z`);
    if (Number.isNaN(deadlineMs)) continue; // e.g. 2026-13-45

    const diff = Math.round((deadlineMs - todayMs) / MS_PER_DAY);

    // Past deadline: retire an untriaged 'found' grant so the board self-cleans.
    // Leave 'drafting' alone (someone is actively working it) and never clobber a
    // human rejection reason. Dead rows aren't re-selected, so the note fires once.
    if (diff < 0) {
      if (g.status === "found" && g.human_score == null) {
        const update: Record<string, unknown> = { status: "dead" };
        if (!g.rejection_reason) update.rejection_reason = "stale";
        await sb.from("grants").update(update).eq("id", g.id);
        await sendNotification(
          sb,
          "deadline",
          `Closed: ${g.funder} - ${g.program_name}`,
          `Deadline ${raw} has passed; moved to Closed. ${linkFor(g)}`.trim(),
        );
        expired++;
      }
      continue;
    }

    if (!MILESTONES.has(diff)) continue;

    // Don't double-ping the same grant on the same day (robust to date/timestamp cols).
    if (String(g.last_deadline_ping ?? "").slice(0, 10) === today) continue;

    const subject = `Deadline in ${diff}d: ${g.funder} - ${g.program_name}`;
    const text = `Deadline ${raw}. ${linkFor(g)}`.trim();

    await sendNotification(sb, "deadline", subject, text);
    await sb.from("grants").update({ last_deadline_ping: today }).eq("id", g.id);
    pinged++;
  }

  return { scanned: grants.length, pinged, expired };
}

// PART C - URL re-validation. Links that were live at discovery time rot later
// (programs close, pages move). Re-check a bounded batch of the least-recently
// verified grants each run. A 'found' grant is retired only after its links come
// back ALL-dead on two consecutive sweeps (dead_link_strikes), so a transient
// 404/timeout self-heals. 'drafting' is warn-only (someone is working it).
const LINK_SWEEP_BATCH = 25;
const DEAD_LINK_STRIKES_TO_KILL = 2;

interface GrantLinkRow {
  id: string;
  funder: string | null;
  program_name: string | null;
  status: string | null;
  human_score: number | null;
  rejection_reason: string | null;
  application_url: string | null;
  source_url: string | null;
  dead_link_strikes: number | null;
}

async function sweepStaleLinks(
  sb: SupabaseClient,
): Promise<{ checked: number; dead: number }> {
  const { data, error } = await sb
    .from("grants")
    .select(
      "id, funder, program_name, status, human_score, rejection_reason, application_url, source_url, dead_link_strikes",
    )
    .in("status", ["found", "drafting"])
    .is("deleted_at", null)
    // Oldest verification first (never-verified rows sort first).
    .order("last_verified", { ascending: true, nullsFirst: true })
    .limit(LINK_SWEEP_BATCH);
  if (error) throw new Error(`could not load grants for link sweep: ${error.message}`);

  const grants = (data ?? []) as GrantLinkRow[];
  let checked = 0;
  let dead = 0;

  for (const g of grants) {
    const urls = [g.application_url, g.source_url].filter(isHttp);
    if (!urls.length) continue; // nothing to re-check
    checked++;

    const results = await Promise.all(urls.map((u) => urlAlive(u)));
    const anyLive = results.some(Boolean);

    if (anyLive) {
      // Healthy: stamp verification and clear any strike.
      await sb
        .from("grants")
        .update({ last_verified: nowIso(), dead_link_strikes: 0 })
        .eq("id", g.id);
      continue;
    }

    // All cited URLs dead this pass. Don't stamp last_verified (so it re-checks
    // next sweep) - retire only after the strike threshold, and only a 'found'
    // grant the human hasn't scored. Never clobber a human rejection reason.
    const strikes = (g.dead_link_strikes ?? 0) + 1;
    const kill =
      strikes >= DEAD_LINK_STRIKES_TO_KILL && g.status === "found" && g.human_score == null;

    if (kill) {
      const update: Record<string, unknown> = {
        status: "dead",
        dead_link_strikes: strikes,
        last_verified: nowIso(),
      };
      if (!g.rejection_reason) update.rejection_reason = "stale";
      await sb.from("grants").update(update).eq("id", g.id);
      await sendNotification(
        sb,
        "deadline",
        `Dead link: ${g.funder} - ${g.program_name}`,
        "All links for this grant are unreachable across repeated checks; moved to Closed.",
      );
      dead++;
    } else {
      await sb.from("grants").update({ dead_link_strikes: strikes }).eq("id", g.id);
      if (g.status === "drafting") {
        console.warn(
          `[jobs] links unreachable for drafting grant "${g.funder} - ${g.program_name}" (strike ${strikes}) - left as-is`,
        );
      }
    }
  }

  return { checked, dead };
}

async function main(): Promise<void> {
  const sb = getServiceClient();
  const apiKey = await resolveAnthropicKey(sb);

  const q = await runQueuedJobs(sb, apiKey);
  const d = await sweepDeadlines(sb);
  const l = await sweepStaleLinks(sb);

  console.log(
    `[jobs] queue: ${q.claimed} claimed, ${q.done} done, ${q.errored} error; ` +
      `deadlines: ${d.pinged} ping(s), ${d.expired} expired across ${d.scanned} tracked grant(s); ` +
      `links: ${l.checked} re-checked, ${l.dead} retired.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[jobs] failed:", (err as Error).message);
    process.exit(1);
  });
