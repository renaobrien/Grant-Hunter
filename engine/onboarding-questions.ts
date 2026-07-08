// The onboarding interview questions — a single source of truth shared by the
// CLI (`npm run onboard`) and the web onboarding flow. Pure data, no imports, so
// it is safe to pull into a client component without dragging in the SDK.

export const ONBOARDING_QUESTIONS: [key: string, prompt: string][] = [
  ["mission", "In 1–2 sentences, what does your org do and why?"],
  [
    "entity",
    "Legal entity, country, and stage? (e.g. '501(c)(3) nonprofit, US, early operating' or 'for-profit LLC, Wyoming US, pre-revenue')",
  ],
  ["capabilities", "List 5–10 things/capabilities you'd want funding for:"],
  [
    "never",
    "What grants should we NEVER show you? (geographies, types, sizes, framings to avoid)",
  ],
  [
    "examples",
    "Name 2–3 grants/funders that would be a PERFECT fit, and 1–2 that look relevant but aren't:",
  ],
  [
    "constraints",
    "Smallest grant worth your time? Can you partner with a fiscal sponsor or university if a funder requires it?",
  ],
  ["url", "(optional) Your website or a one-pager URL — leave blank to skip:"],
];
