// requirements.ts - extract the funder's actual application requirements
// (questions, word/character limits, required sections, scored criteria) from a
// program/application page, so the Drafter answers the real form instead of
// writing a generic essay.
//
// Paste-first is the reliable path (the grant page has a paste box). This is the
// opt-in "try to pull it from the URL" fallback: it FETCHES the page ourselves
// (no agentic web search) and hands the text to one Sonnet call. It fails soft
// on JS-rendered or auth-walled pages, where the operator pastes instead.

import { callClaude, MODELS } from "../anthropic";
import { fetchSiteText } from "../prefill-from-url";
import type { AgentUsage } from "../types";

const SYSTEM = `
You read the text of a grant program / application page and extract exactly what an applicant must submit. Output PLAIN TEXT only (no JSON, no preamble), using only these headers, and omit any header the page doesn't cover:

QUESTIONS / PROMPTS:
- <each application question or narrative prompt, verbatim where possible>

LIMITS:
- <word / character / page limits, per question where stated>

REQUIRED SECTIONS / ATTACHMENTS:
- <budget, letters of support, work plan, etc.>

CRITERIA THEY SCORE ON:
- <stated evaluation criteria or funding priorities>

Include ONLY what the page actually states. Never invent a question or a limit. If the page has none of this (a marketing page, a 404, a login wall), output the single line: NO REQUIREMENTS FOUND ON THIS PAGE.
`.trim();

export async function extractRequirements(
  url: string,
  apiKey: string,
): Promise<{ spec: string; usage: AgentUsage }> {
  // Throws a friendly message when the page can't be read (caller surfaces it).
  const siteText = await fetchSiteText(url);

  const res = await callClaude({
    apiKey,
    system: SYSTEM,
    userMessage: `Extract the application requirements from this page.\n\nPAGE (${url}):\n${siteText}`,
    model: MODELS.sonnet,
    maxTokens: 2000,
  });

  return {
    spec: res.text.trim(),
    usage: {
      model: MODELS.sonnet,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      stopReason: res.stopReason,
      webSearchRequests: res.webSearchRequests,
    },
  };
}
