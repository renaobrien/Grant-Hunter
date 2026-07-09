// The onboarding interview questions - a single source of truth shared by the
// CLI (`npm run onboard`) and the web onboarding flow. Pure data, no imports, so
// it is safe to pull into a client component without dragging in the SDK.
//
// The website URL is handled separately (the web flow can auto-fill answers from
// it; see prefill-from-url.ts), so it is not one of these questions.

export interface OnboardingQuestion {
  key: string;
  /** The question shown to the user. */
  label: string;
  /** A concrete example answer, shown as placeholder + helper text. */
  example?: string;
  /** Required questions block "Set up my profile" until answered. */
  required?: boolean;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    key: "mission",
    label: "In 1-2 sentences, what does your organization do, and why?",
    example:
      "e.g. We build open-source air-quality sensors so low-income neighborhoods can measure pollution and push for change.",
    required: true,
    multiline: true,
  },
  {
    key: "entity",
    label: "What's your legal entity, country, and stage?",
    example:
      "e.g. 501(c)(3) nonprofit, United States, early operating - or: for-profit LLC, Wyoming US, pre-revenue",
    required: true,
  },
  {
    key: "capabilities",
    label: "List 5-10 things you'd want grant funding for.",
    example:
      "e.g. sensor hardware R&D, community workshops, a part-time data scientist, translating materials, a pilot in 2 neighborhoods",
    required: true,
    multiline: true,
  },
  {
    key: "never",
    label: "What grants should we NEVER show you?",
    example:
      "e.g. nothing outside the US, no defense/military funders, nothing under $5k, no corporate-brand sponsorships",
    multiline: true,
  },
  {
    key: "examples",
    label:
      "Name 2-3 grants/funders that would be a PERFECT fit - and 1-2 that look relevant but aren't.",
    example:
      "e.g. Perfect: EPA Environmental Justice grants, Mozilla Technology Fund. Not a fit: academic research grants that require a university PI.",
    multiline: true,
  },
  {
    key: "constraints",
    label:
      "Smallest grant worth your time? And can you use a fiscal sponsor or university partner if a funder requires one?",
    example: "e.g. $10k minimum; yes, we have a fiscal sponsor",
  },
];
