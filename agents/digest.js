const { ask } = require('../lib/claude');
const { SWB_VOICE } = require('../lib/swbvoice');
const { getPreferenceContext, todayIsoDate } = require('../lib/grants');

function buildSearchPrompt(preferenceContext) {
  const today = todayIsoDate();
  return `
${SWB_VOICE}

Today's date is ${today}. Only surface grants whose deadlines are after today (or are clearly rolling with an active cycle).

Human preference calibration from Jesse's prior scoring:
${preferenceContext}

Search the web for newly announced or recently updated grant opportunities for Speech Without Borders. Cover both predefined sources and open-ended searches.

PREDEFINED SOURCES (check the live RFP / grants pages on each — not aggregator listings):
Foundations / direct RFPs:
- Mozilla Foundation, Knight Foundation, Ford Foundation, Omidyar Network, MacArthur Foundation
- Open Society Foundations, Sloan Foundation, National Endowment for the Humanities
- Electronic Frontier Foundation, Access Now

Blockchain / crypto ecosystem:
- Ethereum Foundation, Filecoin Foundation, Web3 Foundation, Gitcoin Grants

Policy / academic:
- Berkman Klein Center (Harvard), Stanford Internet Observatory, Yale Jackson Institute, Ash Center (Harvard Kennedy School)

OPEN-ENDED SEARCHES (mix these queries — surface anything credible that comes up):
- "free expression" grant 2026 OR 2027
- "digital rights" funding RFP
- "platform governance" grant
- "content moderation" research funding
- "internet freedom" grant 2026
- "online speech" foundation grant
- "blockchain governance" privacy grant
- "decentralized voting" funding
- "AI" "free expression" grant
- recent funding announcements in digital rights / speech / platform policy

QUALITY FILTER:
- Skip evergreen "we accept proposals year-round" listings unless there's a current cycle with a real deadline.
- Skip aggregator-only listings; pull from the funder's actual program page.
- Skip anything below ~$10K unless it is a prestigious named program.
- Skip anything where SWB is clearly ineligible (e.g. funder requires US 501(c)(3) and SWB is ineligible — flag in blockers if uncertain rather than dropping).

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
      "framingAngle": "best SWB angle (e.g. 'platform governance research', 'on-chain privacy + voting')",
      "eligibilityNotes": "for-profit / nonprofit / geographic / partner requirements",
      "blockers": "main disqualifier or risk; 'Unknown' if none clear",
      "notes": "2 short sentences on fit and why it matches SWB now",
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

async function runDigest() {
  const preferenceContext = await getPreferenceContext();
  const { text, usage } = await ask(
    buildSearchPrompt(preferenceContext),
    `Run this week's grant digest for Speech Without Borders. Today's date is ${todayIsoDate()}.`,
    { useSearch: true },
  );
  const parsed = parseDigest(text);
  return { ...parsed, usage };
}

module.exports = { runDigest };
