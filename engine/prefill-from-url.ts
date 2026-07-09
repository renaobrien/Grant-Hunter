// prefill-from-url.ts - read an organization's website and draft answers to the
// onboarding questions, so a user can start from a filled-in form and just edit.
// Powers the web onboarding "fill from my website" button.
import { callClaude, MODELS, parseJsonFromResponse } from "./anthropic";
import { ONBOARDING_QUESTIONS } from "./onboarding-questions";

const SYSTEM = `
You research an organization's public website and fill in a short grant-intake form on their behalf. Visit the URL (and a page or two it links to, like About / Mission), then answer each question the way the organization plausibly would - concise, factual, first person plural ("we").

Output ONLY a JSON object whose keys are exactly the question keys given, each mapped to a short string answer. If the site genuinely doesn't say, use "" (empty string) - do not invent facts. No prose outside the JSON.
`.trim();

/**
 * Returns a partial answers map keyed by ONBOARDING_QUESTIONS keys. Missing/blank
 * fields are simply left for the user to complete. Throws on API errors (the
 * caller maps them to a friendly message).
 */
export async function draftAnswersFromUrl(
  url: string,
  apiKey: string,
): Promise<Record<string, string>> {
  const questionList = ONBOARDING_QUESTIONS.map(
    (q) => `- ${q.key}: ${q.label}`,
  ).join("\n");

  const userMessage = [
    `Organization website: ${url}`,
    "",
    "Fill in this intake form from what you can find on their site.",
    "Answer each of these keys with a JSON string value:",
    questionList,
  ].join("\n");

  const res = await callClaude({
    apiKey,
    system: SYSTEM,
    userMessage,
    model: MODELS.sonnet,
    maxTokens: 2000,
    webSearchMaxUses: 5,
  });

  const parsed = parseJsonFromResponse(res.text, res.stopReason) as Record<
    string,
    unknown
  >;

  // Keep only known question keys with non-empty string values.
  const out: Record<string, string> = {};
  for (const q of ONBOARDING_QUESTIONS) {
    const v = parsed?.[q.key];
    if (typeof v === "string" && v.trim()) out[q.key] = v.trim();
  }
  return out;
}
