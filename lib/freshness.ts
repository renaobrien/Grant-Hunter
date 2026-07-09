// Shared freshness helpers for the board + grant detail. Pure; safe in server
// components. A grant whose ISO deadline is in the past has lapsed; the jobs
// sweep retires these, but the UI flags them the moment they pass so a stale
// grant is obvious even before the next sweep runs.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `deadline` is a bare ISO date already in the past (UTC). */
export function deadlinePassed(deadline: string | null): boolean {
  const raw = String(deadline ?? "").trim();
  if (!ISO_DATE.test(raw)) return false;
  const ms = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  const today = new Date().toISOString().slice(0, 10);
  return ms < Date.parse(`${today}T00:00:00Z`);
}

/** Whole days until an ISO deadline (negative if past), or null if not ISO. */
export function daysUntilDeadline(deadline: string | null): number | null {
  const raw = String(deadline ?? "").trim();
  if (!ISO_DATE.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((ms - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** "checked 3d ago" from an ISO timestamp, or null when never verified. */
export function checkedAgo(lastVerified: string | null): string | null {
  if (!lastVerified) return null;
  const ms = Date.parse(lastVerified);
  if (Number.isNaN(ms)) return null;
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "checked today";
  return `checked ${days}d ago`;
}
