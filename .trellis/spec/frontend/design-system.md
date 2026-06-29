# Design System: Material Design 3

> The project's visual language. All frontend work (public site and admin) must conform to this.

---

## Source of Truth

- **Specification**: Material Design 3 (Material You), https://m3.material.io
- **Token reference**: Material Design 3 design tokens (color, elevation, shape, motion, typography).
- **Implementation**: Astro pages + Svelte islands. Prefer hand-written CSS with Material 3 tokens over heavy UI frameworks (to keep the Cloudflare Worker bundle small). If a Svelte Material component library is adopted later, it must implement Material 3 (not Material 2) and be recorded here.

## Color

- Use a Material 3 **tonal color scheme**: primary / on-primary / primary-container / on-primary-container / secondary / tertiary / surface / on-surface / surface-variant / outline / error / background.
- Define a single CSS custom-property scheme in `src/styles/tokens.css` (`--md-sys-color-primary`, etc.) so light/dark themes can swap by `prefers-color-scheme` or a `data-theme` attribute.
- Dark theme is required (Material 3 expects both schemes). Provide both.

## Typography

- Material 3 type scale tokens: display / headline / title / label / body (large/medium/small).
- Fonts: prefer Material's Roboto + Noto Sans SC for Chinese coverage; fall back to system UI fonts. Keep font payload small (use `font-display: swap`, self-host or Google Fonts CSS only — confirm Cloudflare bundle/perf budget).
- Map tokens to CSS: `--md-sys-typescale-title-large`, etc.

## Elevation & Shape

- Use Material 3 elevation tokens (level 0–5) via `box-shadow` or `::after` overlay; do not improvise shadows.
- Shape scale tokens (extra-small … full); cards use medium/large, buttons full (pill) per M3, dialogs extra-large.

## Components (M3 patterns to follow)

- **Cards**: filled / outlined / elevated; event list items use Material card.
- **Buttons**: filled / tonal / outlined / text; primary action filled, secondary outlined.
- **Forms**: Material 3 text fields (filled / outlined), chips for tags, list / dropdown for selects, switches/checkboxes.
- **Navigation**: top app bar (public) + navigation drawer / rail (admin); tab bars where useful.
- **Tables (admin)**: Material data table patterns (header, row hover, pagination).
- **Dialogs**: Material 3 basic dialog for confirmations (offline / merge / reject reason).
- **Snackbar**: Material 3 snackbar for action feedback (approve / save success).

## Motion

- Use Material 3 motion tokens (duration, easing) — e.g. `--md-sys-motion-duration-medium`, `--md-sys-motion-easing-standard`. No ad-hoc transitions.

## Iconography

- Material Symbols (rounded variable font) for icons. Single import, weight/grade/fill via font axes.

## Accessibility

- Follow M3 accessibility: color-contrast tokens (on-color pairs meet WCAG AA), focus indicators, tap targets ≥ 48px, semantic HTML, reduced-motion respect.

## Forbidden patterns

- Mixing Material 2 component styles (flat buttons, legacy ` elevation`) with Material 3.
- Hand-picked hex colors outside the token scheme.
- Heavy CSS frameworks (Tailwind, etc.) unless explicitly approved and added to this file — current decision: **no Tailwind**, hand-written tokenized CSS.
- Hard-coded shadow/easing values bypassing motion/elevation tokens.

## Adoption note

- This file is the frontend visual contract. When implementing components in `06-29-public-site` and `06-29-admin-review`, create `src/styles/tokens.css` (and a small set of base component classes) as the first frontend step, then build pages against it.
