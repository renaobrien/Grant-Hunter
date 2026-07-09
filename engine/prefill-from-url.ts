// prefill-from-url.ts - read an organization's website and draft answers to the
// onboarding questions, so a user can start from a filled-in form and just edit.
// Powers the web onboarding "fill from my website" button.
//
// We FETCH the page ourselves and hand its text to Claude in a single call.
// (The agentic web-search tool loops search->read and takes minutes - far too
// slow for an interactive button.)
import { callClaude, MODELS, parseJsonFromResponse } from "./anthropic";
import { ONBOARDING_QUESTIONS } from "./onboarding-questions";

const SYSTEM = `
You read the text of an organization's website and fill in a short grant-intake form on their behalf. Base every answer ONLY on the provided website text - answer the way the organization would, concise, factual, first person plural ("we").

Output ONLY a JSON object whose keys are exactly the question keys given, each mapped to a short string answer. If the text genuinely doesn't cover a field, use "" (empty string) - never invent facts. No prose outside the JSON.
`.trim();

const FETCH_TIMEOUT_MS = 12_000;
const MAX_TEXT_CHARS = 8_000;

/** Strip a fetched HTML page down to readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch a URL and return its visible text, bounded in time and size. */
async function fetchSiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; GrantHunter/1.0; onboarding profile assistant)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`site returned HTTP ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html);
    if (text.length < 40) throw new Error("no readable text on that page");
    return text.slice(0, MAX_TEXT_CHARS);
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "the site took too long to respond" : (e as Error).message;
    throw new Error(
      `Couldn't read ${url} automatically (${msg}). Fill in the fields below by hand.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a partial answers map keyed by ONBOARDING_QUESTIONS keys. Missing/blank
 * fields are left for the user to complete. Throws (with a friendly message) if
 * the site can't be read or the model call fails; the caller surfaces it.
 */
export async function draftAnswersFromUrl(
  url: string,
  apiKey: string,
): Promise<Record<string, string>> {
  const siteText = await fetchSiteText(url);

  const questionList = ONBOARDING_QUESTIONS.map(
    (q) => `- ${q.key}: ${q.label}`,
  ).join("\n");

  const userMessage = [
    "Fill in this intake form from the website text below.",
    "Answer each of these keys with a JSON string value:",
    questionList,
    "",
    `WEBSITE (${url}):`,
    siteText,
  ].join("\n");

  const res = await callClaude({
    apiKey,
    system: SYSTEM,
    userMessage,
    model: MODELS.sonnet,
    maxTokens: 1500,
  });

  const parsed = parseJsonFromResponse(res.text, res.stopReason) as Record<
    string,
    unknown
  >;

  const out: Record<string, string> = {};
  for (const q of ONBOARDING_QUESTIONS) {
    const v = parsed?.[q.key];
    if (typeof v === "string" && v.trim()) out[q.key] = v.trim();
  }
  return out;
}
