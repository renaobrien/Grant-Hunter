// anthropic.ts - Claude wrapper built on the official SDK (@anthropic-ai/sdk),
// which gives us retries (429/5xx) and request timeouts for free. Adds:
//   - pause_turn continuation (server-side web search can pause a long tool loop)
//   - per-model web search tool versions
//   - cost estimation (tokens + web search fees) for the daily budget cap
//   - JSON parse/salvage for truncated agent responses

import Anthropic from "@anthropic-ai/sdk";

/** Current Claude model ids. Pick per agent role. */
export const MODELS = {
  opus: "claude-opus-4-8", // quality-critical adversaries + drafter
  sonnet: "claude-sonnet-5", // high-volume discovery search
  haiku: "claude-haiku-4-5", // cheap single-page verification / refresh
} as const;

interface ClaudeOptions {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  webSearchMaxUses?: number;
}

export interface ClaudeResponse {
  text: string;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
}

// The server-side web search loop pauses after ~10 iterations; resume by
// echoing the assistant turn. Cap continuations so a pathological loop ends.
const MAX_CONTINUATIONS = 4;

// Strip em/en dashes from all model output so they never reach the compiled
// profile, drafts, or UI. Safe to run before JSON.parse: dashes only ever
// appear inside string values, never in JSON structure.
function stripFancyDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, " - ");
}

// ---------------------------------------------------------------------------
// Provider selection. Default is Anthropic. Set LLM_PROVIDER=ollama (local
// instances only) to run the agents on a local model via Ollama - free, private,
// no Anthropic key. Caveat: Ollama has no server-side web search, so discovery's
// Finder/Skeptic can't verify live pages (drafting, judging, distilling, profile
// compile, and requirements extraction all work fully). Config is read from the
// environment so spawned engine runs (which reload .env.local) pick it up.
// ---------------------------------------------------------------------------
export const isOllama = (): boolean =>
  (process.env.LLM_PROVIDER ?? "").trim().toLowerCase() === "ollama";

/** Call a local Ollama model via its native /api/chat. No tools, no web search. */
async function callOllama(options: ClaudeOptions): Promise<ClaudeResponse> {
  const base = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1";

  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.userMessage },
        ],
        options: { num_predict: options.maxTokens ?? 4096 },
      }),
      // Local generation can be slow on big models; give it room.
      signal: AbortSignal.timeout(20 * 60 * 1000),
    });
  } catch (e) {
    throw new Error(
      `Couldn't reach Ollama at ${base} (${(e as Error).message}). Is 'ollama serve' running and the model pulled?`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama returned HTTP ${res.status} for model '${model}'. ${body.slice(0, 200)}`.trim(),
    );
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const text = stripFancyDashes((data.message?.content ?? "").trim());
  if (!text) {
    throw new Error(`Ollama model '${model}' returned no text. Try a larger/instruct model.`);
  }
  return {
    text,
    stopReason: data.done_reason ?? "stop",
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    webSearchRequests: 0,
  };
}

/**
 * Turn a raw Claude/Anthropic error into a short, actionable message for the UI.
 * The SDK surfaces provider errors as messages containing the provider's text
 * and status; we match on the common cases so users see "add credits" instead
 * of a 400 JSON blob.
 */
export function friendlyClaudeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const low = raw.toLowerCase();
  if (low.includes("credit balance is too low") || low.includes("plans & billing")) {
    return "Your Anthropic account is out of credits. Add credits at https://console.anthropic.com/settings/billing, then try again.";
  }
  if (
    low.includes("invalid x-api-key") ||
    low.includes("authentication_error") ||
    low.includes("invalid api key") ||
    low.includes(" 401")
  ) {
    return "Your Anthropic API key looks invalid. Check it under Settings -> API keys.";
  }
  if (
    low.includes("rate_limit") ||
    low.includes("rate limit") ||
    low.includes(" 429") ||
    low.includes("overloaded") ||
    low.includes(" 529")
  ) {
    return "Anthropic is busy or rate-limiting right now. Wait a minute and try again.";
  }
  if (low.includes("no anthropic api key")) {
    return raw; // already a clear, actionable message from resolveAnthropicKey()
  }
  return `The AI request failed: ${raw}`;
}

let cachedClient: Anthropic | null = null;
let cachedKey = "";
function getClient(apiKey: string): Anthropic {
  if (!cachedClient || cachedKey !== apiKey) {
    // timeout: web-search-heavy Finder calls legitimately run past the SDK's
    // ~10-minute default and were dying with "Request timed out." mid-run.
    // 25 min covers a slow multi-search turn.
    // maxRetries: the SDK retries 429 / 5xx / overloaded with exponential backoff
    // + jitter. Bumped to 4 as more agents (distiller, requirements extractor)
    // are added; engine calls run sequentially, so no concurrency limiter is
    // needed on top of this.
    cachedClient = new Anthropic({
      apiKey,
      maxRetries: 4,
      timeout: 25 * 60 * 1000,
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

/** Newer models get the dynamic-filtering web search; haiku keeps the basic one. */
function webSearchTool(model: string, maxUses: number): Anthropic.Messages.ToolUnion {
  const type = model.includes("haiku") ? "web_search_20250305" : "web_search_20260209";
  return { type, name: "web_search", max_uses: maxUses } as Anthropic.Messages.ToolUnion;
}

export async function callClaude(options: ClaudeOptions): Promise<ClaudeResponse> {
  // Local model path: route to Ollama and skip everything Anthropic-specific
  // (client, web search tools, pause_turn continuation).
  if (isOllama()) return callOllama(options);

  const {
    apiKey,
    system,
    userMessage,
    model = MODELS.sonnet,
    maxTokens = 16000,
    webSearchMaxUses,
  } = options;

  const client = getClient(apiKey);
  const tools = webSearchMaxUses ? [webSearchTool(model, webSearchMaxUses)] : undefined;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  let inputTokens = 0;
  let outputTokens = 0;
  let webSearchRequests = 0;
  const textParts: string[] = [];
  let stopReason = "";

  for (let attempt = 0; ; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      ...(tools ? { tools } : {}),
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    const serverToolUse = (
      response.usage as { server_tool_use?: { web_search_requests?: number } }
    ).server_tool_use;
    webSearchRequests += serverToolUse?.web_search_requests ?? 0;

    for (const block of response.content) {
      if (block.type === "text" && block.text) textParts.push(block.text);
    }
    stopReason = response.stop_reason ?? "";

    if (stopReason !== "pause_turn" || attempt >= MAX_CONTINUATIONS) break;
    // Server paused mid tool loop - append the assistant turn as-is and resume.
    messages.push({ role: "assistant", content: response.content });
  }

  const text = stripFancyDashes(textParts.join("\n"));
  if (!text.trim()) {
    // Tokens were already spent to get here, so carry the usage on the error:
    // tracked() bills it to the daily cap instead of recording null cost.
    throw Object.assign(
      new Error(
        `No text in API response (stop_reason: ${stopReason}). Model may have exhausted tool calls without a summary.`,
      ),
      { usage: { model, inputTokens, outputTokens, stopReason, webSearchRequests } },
    );
  }

  return { text, stopReason, inputTokens, outputTokens, webSearchRequests };
}

/**
 * Estimate cost in cents for the daily budget cap. Rates are cents per million
 * tokens [input, output] at list price (2026-07: opus $5/$25, sonnet $3/$15,
 * haiku $1/$5), plus web search at $10 per 1,000 searches (= 1 cent each).
 * Rounds UP so many small calls can't slip under the cap.
 */
export function estimateCostCents(
  inputTokens: number,
  outputTokens: number,
  model: string,
  webSearchRequests = 0,
): number {
  // Local models are free - no spend against the daily cap.
  if (isOllama()) return 0;
  const rates: Record<string, [number, number]> = {
    opus: [500, 2500],
    sonnet: [300, 1500],
    haiku: [100, 500],
  };
  const key = model.includes("opus")
    ? "opus"
    : model.includes("haiku")
    ? "haiku"
    : "sonnet";
  const [inRate, outRate] = rates[key];
  const cents =
    (inputTokens / 1_000_000) * inRate +
    (outputTokens / 1_000_000) * outRate +
    webSearchRequests * 1;
  return Math.ceil(cents);
}

/**
 * Parse JSON from a Claude text response. Handles markdown fences, prose wrapping,
 * and truncation salvage.
 *
 * `prefer` says which top-level shape to extract: agents that return a list use
 * "array" (default); the profile compiler returns a single object that itself
 * contains arrays, so it passes "object" - otherwise the first inner array gets
 * mis-extracted and parsing fails.
 */
export function parseJsonFromResponse(
  text: string,
  stopReason: string,
  prefer: "array" | "object" = "array",
): unknown {
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (prefer === "object" && objMatch) {
    cleaned = objMatch[0];
  } else if (prefer === "array" && arrayMatch) {
    cleaned = arrayMatch[0];
  } else if (objMatch) {
    cleaned = objMatch[0];
  } else if (arrayMatch) {
    cleaned = arrayMatch[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    if (stopReason === "max_tokens") {
      const lastComplete = cleaned.lastIndexOf("},");
      if (lastComplete > 0) {
        const bracketStart = cleaned.indexOf("[");
        const start = bracketStart >= 0 ? bracketStart : 0;
        try {
          const salvaged = JSON.parse(cleaned.substring(start, lastComplete + 1) + "]");
          console.warn(
            `Salvaged ${Array.isArray(salvaged) ? salvaged.length : 1} items from truncated response`,
          );
          return salvaged;
        } catch { /* fall through */ }
      }
      const lastObjComplete = cleaned.lastIndexOf('",');
      if (lastObjComplete > 0) {
        const objStart = cleaned.indexOf("{");
        if (objStart >= 0) {
          try {
            return JSON.parse(cleaned.substring(objStart, lastObjComplete + 1) + '"}');
          } catch { /* fall through */ }
        }
      }
    }
    throw new Error(
      `Failed to parse JSON (stop_reason: ${stopReason}): ${cleaned.substring(0, 300)}`,
    );
  }
}
