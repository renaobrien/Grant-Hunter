"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GRANT_STATUSES, type GrantStatus } from "@/lib/types";

export async function updateGrantStatus(id: string, status: string) {
  if (!GRANT_STATUSES.includes(status as GrantStatus)) {
    throw new Error(`Invalid grant status: ${status}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grants")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update grant status: ${error.message}`);
  }

  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// In-app feedback → GitHub issue
// ---------------------------------------------------------------------------
// Files a GitHub issue in the configured repo. A screenshot (if attached) is
// uploaded to a public Supabase Storage bucket and embedded in the issue body —
// it is NOT committed to the repo. White-label: repo + token come from env,
// never hardcoded. The GitHub token is server-only; it never reaches the browser.

export type FeedbackType = "bug" | "idea" | "other";

export interface FeedbackInput {
  type: FeedbackType;
  title: string;
  details: string;
  pagePath: string;
  userAgent?: string;
  consoleLog?: string;
  /** data URL: "data:image/png;base64,...." */
  screenshot?: string | null;
}

const GH_API = "https://api.github.com";
const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "bug",
  idea: "enhancement",
  other: "feedback",
};

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

/** Upload a PNG to the public `feedback` Storage bucket; return its public URL. */
async function uploadScreenshot(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;

  const { createServiceClient } = await import("@/lib/supabase/service");
  const sb = createServiceClient();
  const { error } = await sb.storage
    .from("feedback")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) return null;

  return sb.storage.from("feedback").getPublicUrl(path).data.publicUrl;
}

export async function submitFeedbackIssue(
  input: FeedbackInput,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const title = input.title.trim();
  const details = input.details.trim();
  if (!title && !details) {
    return { ok: false, error: "Add a title or some detail first." };
  }

  const repo = process.env.GITHUB_FEEDBACK_REPO; // "owner/repo"
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!repo || !token) {
    return {
      ok: false,
      error:
        "Feedback isn't configured yet — set GITHUB_FEEDBACK_REPO and GITHUB_FEEDBACK_TOKEN.",
    };
  }

  // Attribution (best-effort; RLS-authed client already gates who can be here).
  let reporter: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    reporter = user?.email ?? null;
  } catch {
    /* attribution is optional */
  }

  // Screenshot → Storage upload → markdown embed.
  let shotMarkdown = "";
  if (input.screenshot) {
    try {
      const url = await uploadScreenshot(input.screenshot);
      if (url) shotMarkdown = `\n\n![screenshot](${url})`;
    } catch {
      /* non-fatal: file the issue without the image */
    }
  }

  const meta = [
    `**Type:** ${input.type}`,
    `**Page:** \`${input.pagePath || "—"}\``,
    reporter ? `**Reported by:** ${reporter}` : null,
    input.userAgent ? `**User agent:** ${input.userAgent}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const consoleBlock = input.consoleLog?.trim()
    ? `\n\n<details><summary>Console log</summary>\n\n\`\`\`\n${input.consoleLog.trim()}\n\`\`\`\n\n</details>`
    : "";

  const body = `${meta}\n\n### Details\n\n${details || "_(none)_"}${shotMarkdown}${consoleBlock}\n\n---\n_Filed from the in-app feedback button._`;

  const issueTitle = title || details.split("\n")[0].slice(0, 80);

  const res = await fetch(`${GH_API}/repos/${repo}/issues`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      title: issueTitle,
      body,
      labels: ["feedback", TYPE_LABEL[input.type]],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      error: `GitHub rejected the issue (${res.status}). ${detail.slice(0, 140)}`,
    };
  }

  const issue = (await res.json()) as { html_url?: string };
  return { ok: true, url: issue.html_url };
}
