import React from "react";

/**
 * Chip — small pill label with a tone. Tones: neutral, muted, info, good, warn,
 * bad, brand. Default is a bare muted pill; "neutral" is the bordered surface
 * variant. Used for recommendations, verdicts, statuses, and cron summaries.
 */
export function Chip({ label, tone = "neutral" }) {
  return <span className={`chip chip-${tone}`}>{label}</span>;
}
