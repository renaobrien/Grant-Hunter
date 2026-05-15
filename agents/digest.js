const { ask } = require('../lib/claude');
const { VOICE } = require('../lib/voice');
const { getPreferenceContext, todayIsoDate } = require('../lib/grants');

function buildSearchPrompt(preferenceContext, directive) {
  const today = todayIsoDate();
  const directiveBlock = directive
    ? `\nSTEERING NOTE FOR THIS RUN ONLY (from the user, treat as priority guidance on top of standing context):\n${directive}\n`
    : '';
  return `
${VOICE}

Today's date is ${today}. Only surface grants whose deadlines are after today (or are clearly rolling with an active cycle).

Human preference calibration from the user's prior scoring:
${preferenceContext}
${directiveBlock}
Search the web for newly announced or recently updated grant opportunities aligned with the user's mission as defined in the USER CONTEXT section above. Cover both predefined sources and open-ended searches keyed off the user's priority themes.

PREDEFINED SOURCES (check the live RFP / grants pages on each — not aggregator listings):
Foundations / direct RFPs:
- Major foundations the user listed under "FUNDERS TO ALWAYS CHECK"
- Generally: Mozilla, Knight, Ford, Omidyar Network, MacArthur, Open Society, Sloan, NEH

Blockchain / crypto ecosystem (only if relevant to the user's focus areas):
- Ethereum Foundation, Filecoin Foundation, Web3 Foundation, Gitcoin Grants

Policy / academic (only if relevant):
- Berkman Klein (Harvard), Stanford Internet Observatory, Yale Jackson Institute, Ash Center

OPEN-ENDED SEARCHES — generate 8-12 queries from the user's PRIORITY THEMES. Combine themes with the current year and common grant-search modifiers like "RFP", "funding", "grant", "fellowship", "open call". Skip themes that don't match the mission.

QUALITY FILTER:
- Skip evergreen "we accept proposals year-round" listings unless there's a current cycle with a real deadline.
- Skip aggregator-only listings; pull from the funder's actual program page.
- Skip anything below ~$10K unless it is a prestigious named program.
- Skip anything where the user is clearly ineligible (per their ELIGIBILITY CONSTRAINTS) — flag in blockers if uncertain rather than dropping.

Return ONLY a JSON object with this shape (no prose before or after):
{
  "summary": "one-line summary of what this week's search surfaced",
  "opportunities": [
    {
      "funder": "funder name",
      "program": "program name",
      "amount": "$50K-$250K or unknown",
      "deadline": "YYYY-MM-DD or rolling or unknown",
      "fitScore": 4,
      "recommendation": "pursue | maybe | pass",
      "confidence": "low | medium | high",
      "framingAngle": "best angle for the user's mission (e.g. 'platform governance research', 'on-chain privacy + voting')",
      "eligibilityNotes": "for-profit / nonprofit / geographic / partner requirements",
      "blockers": "main disqualifier or risk; 'Unknown' if none clear",
      "notes": "2 short sentences on fit and why it matches the user's mission now",
      "contacts": "program officer name + email if visible on the page, else empty",
      "sourceUrl": "official program page URL",
      "applicationUrl": "application page if distinct, else same as sourceUrl"
    }
  ]
}

Aim for 5-10 high-quality opportunities. Quality over quantity. Skip 'pass' recommendations entirely from the output.
`;
}

function parseDigest(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const arrayMatch = jsonText.match(/"opportunities"\s*:\s*\[[\s\S]*/);
    if (arrayMatch) {
      const lastComplete = arrayMatch[0].lastIndexOf('},');
      if (lastComplete > 0) {
        const salvaged = arrayMatch[0].substring(arrayMatch[0].indexOf('['), lastComplete + 1) + ']';
        try {
          const items = JSON.parse(salvaged);
          console.warn(`Salvaged ${items.length} opportunities from truncated response`);
          return { summary: 'Digest partially recovered from truncated response.', opportunities: items };
        } catch { /* salvage failed */ }
      }
    }
    throw new Error(`Failed to parse digest JSON: ${jsonText.substring(0, 200)}`);
  }

  return {
    summary: parsed.summary || 'No summary provided.',
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
  };
}

async function runDigest({ directive = '' } = {}) {
  const preferenceContext = await getPreferenceContext();
  const userMessage = directive
    ? `Run this week's grant digest for the user's mission. Today's date is ${todayIsoDate()}. Steering note: ${directive}`
    : `Run this week's grant digest for the user's mission. Today's date is ${todayIsoDate()}.`;
  const { text, usage } = await ask(
    buildSearchPrompt(preferenceContext, directive),
    userMessage,
    { useSearch: true },
  );
  const parsed = parseDigest(text);
  return { ...parsed, usage };
}

module.exports = { runDigest };
