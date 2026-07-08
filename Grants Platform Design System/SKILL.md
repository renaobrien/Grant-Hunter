---
name: grants-platform-design
description: Use this skill to generate well-branded interfaces and assets for grants-platform (a white-label, self-hosted grant discovery + application tool), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, spacing tokens, and the UI kit components for prototyping. White-label — brand colors are runtime-swappable; never hardcode an org.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available
files (`styles.css` + `tokens/*.css` + `app.css` for the foundations,
`components/core/` for the primitives, `ui_kits/grants-app/` for full-screen
recreations).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
`styles.css` (and the `tokens/` + `app.css` files it imports) out and create
static HTML files that link it, using the className hooks (`.card`, `.board`,
`.grant-card`, `.chip-*`, `.data-table`, `.debate-round`, `.btn`, …) documented
in `readme.md` and demonstrated in `ui_kits/grants-app/screens.jsx`. If working
on production code, copy the tokens/classes and read the rules here to become an
expert in designing with this system.

**Two hard rules, always:**
1. **White-label.** Never hardcode an organization's name, logo, colors, or copy.
   The three brand vars (`--brand-primary`, `--brand-accent`, `--brand-bg`) are
   injected at runtime from the org profile; the values in `tokens/colors.css`
   are only the pre-onboarding fallback. Everything must look right with any
   brand values.
2. **Stay in character.** Warm-paper neutral, calm, low-chrome, scannable. No
   gradients, no decorative emoji, near-zero icons, minimal motion, sentence-case
   copy. See the CONTENT FUNDAMENTALS and VISUAL FOUNDATIONS sections of
   `readme.md`.

If the user invokes this skill without any other guidance, ask them what they
want to build or design, ask some questions, and act as an expert designer who
outputs HTML artifacts _or_ production code, depending on the need.
