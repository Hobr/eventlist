# Design System: Bits UI + Tailwind v4 Frontend

> The project's visual language for public and admin frontend work.

---

## Source of Truth

- **Component direction**: shadcn-svelte-style headless primitives built on
  `bits-ui`, styled with Tailwind CSS v4 + the `cn()` helper.
- **Implementation**: Astro pages + Svelte islands (Svelte 5 runes).
- **Style layer**: Tailwind CSS v4 via `@tailwindcss/vite`. No handwritten
  component CSS; all layout/visual rules live in Tailwind utility classes on
  the components. `@theme inline` in `src/styles/app.css` bridges the semantic
  tokens defined in `src/styles/tokens.css` into Tailwind utilities
  (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, ...).
- **Interactive primitives**: `bits-ui` (v2) for Svelte controls that need
  headless behavior. Wrap them in small typed components under
  `src/components/ui/` — never consume `bits-ui` directly from pages/business
  components.
- **Class merge utility**: `src/lib/utils.ts` exports `cn(...)` built on
  `clsx` + `tailwind-merge`. NOTE: the `cn-division` package is a China
  administrative-division dataset, NOT a class-merge utility — do not confuse
  the two.
- **Icons**: `@lucide/svelte`, imported per-icon from
  `@lucide/svelte/icons/<name>` for tree-shaking. The Material Symbols Rounded
  font is removed; do not reintroduce it.
- **Token source**: `src/styles/tokens.css` defines the shared visual tokens
  and is consumed by `app.css`'s `@theme inline` block. `app.css` also holds
  the minimal base reset (box-sizing, body font, focus-visible ring,
  prefers-reduced-motion).

## Token Contract

- Use semantic custom properties in `src/styles/tokens.css`:
    - colors: `--color-background`, `--color-foreground`, `--color-surface`,
      `--color-surface-subtle`, `--color-surface-raised`, `--color-border`,
      `--color-border-strong`, `--color-primary`, `--color-primary-foreground`,
      `--color-primary-subtle`, `--color-accent`, `--color-danger`, etc.
    - shape: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-full`.
    - motion: `--duration-fast`, `--duration-medium`, `--ease-standard`.
    - focus/shadow: `--shadow-focus`, `--shadow-popover`.
- `@theme inline` exposes them as Tailwind tokens, so prefer
  `bg-surface`, `text-muted-foreground`, `border-border-strong`,
  `ring-ring/40`, etc. Do not hand-write `var(--color-*)` in components when a
  Tailwind utility exists for it.
- Provide light and dark values through `prefers-color-scheme` in
  `tokens.css`. Dark mode is automatic; do NOT add a `.dark` class toggle or
  ThemeToggle unless a future task explicitly requests manual control.
- Do not reintroduce `--md-sys-*` tokens or Material 3 as the frontend
  contract.

## Layout And Density

- Public pages should feel like a browsing tool: practical, scannable, and
  information-dense.
- Admin pages should feel operational: compact navigation, crisp tables,
  predictable controls, and no marketing-style composition.
- Use cards (`ui/card`) and repeated items at `rounded-md` (8px) or less.
- Avoid nested cards; page sections should be normal layout bands or
  constrained content, while cards are for repeated items, forms, tables, and
  modals.
- Do not scale font sizes with viewport width. Use Tailwind's fixed text
  sizes and breakpoint (`sm:` / `lg:`) adjustments.

## UI Primitive Layer (`src/components/ui/`)

- Primitives are Svelte 5 runes components, accept a `class` prop, and merge
  it via `cn()` so callers can override/extend safely.
- Existing primitives: `button`, `badge`, `card` + `card-header` /
  `card-title` / `card-description` / `card-content` / `card-footer`,
  `input`, `label`, `textarea`, `separator`, `table` + `table-header` /
  `table-body` / `table-row` / `table-head` / `table-cell`.
- Add a new primitive here when a pattern repeats across 3+ pages. Avoid
  pulling in a second runtime UI library (shadcn-svelte CLI bundles, daisyUI,
  etc.) — the `ui/` layer is hand-maintained.
- Keep `ui/` components free of business field semantics (no `event`,
  `division`, etc.).

## Business Components

- `SelectField.svelte` is the shared Bits UI `Select` wrapper. Preserve its
  prop contract when restyling:
    - `name`, `label`, `value`, `options`, `placeholder`, `required`,
      `disabled`, `wide`, `onchange`.
- `DivisionPicker.svelte`, `CitySelector.svelte`, and `FilterBar.svelte`
  depend on `SelectField.svelte`; visual changes must keep URL query names
  and hidden form field behavior intact.
- `TagInput.svelte` keeps the hidden `name="tags"` input joined by `、`.
- `EventCard.astro` and `admin/EventTable.astro` / `admin/Pagination.astro`
  consume `ui/` primitives, not raw Tailwind long-class strings.
- Keep action buttons icon+text where the icon clarifies the command
  (Lucide icons).

## Public Page Structure

- Homepage first viewport should be an application-like tool surface, not a
  generic marketing hero: city selection + key metrics + a compact live
  browse preview. No narrative copy ("command / dossier / radar / LIVE
  PREVIEW") — use neutral, scannable Chinese labels.
- Event browsing should use a persistent filter rail plus compact event
  rows as the primary list shape. Do not return to a heading + toolbar panel
    - three-column card grid as the default browsing mode.
- Event details should use a card grid: header (badges + title + cover) →
  fact tiles (time/region/venue) → description → actions aside, so core
  facts and actions are visible before long-form description.
- Public submission should use sectioned cards while preserving every
  `name` attribute expected by `/api/submit`.

## Copy Voice

- Neutral, tool-style, scannable Chinese. No marketing flourishes, no
  militarized nouns ("情报表", "雷达", "指令台"), no all-caps English
  kickers ("COMMAND", "DOSSIER", "LIVE PREVIEW").
- Keep information density; do not pad with slogans. Section headings may
  use a number prefix (`01 活动识别`) for ordering, not decorative tags.

## Public Hero And Media

- Public landing heroes must use a real or bitmap activity/event image as
  the visual anchor. Do not use a pure CSS gradient or abstract SVG as the
  primary hero background.
- Hero text may overlay the image directly with a contrast layer.
- Public event cards may use a tokenized placeholder when a cover URL is
  missing, but real `cover_url` values should render as inspectable images.

## Accessibility

- Preserve semantic HTML for navigation, forms, tables, and details.
- Keep visible focus states (Tailwind `focus-visible:ring-*`, mapped to
  `--shadow-focus` via the `ring-ring` token).
- Respect `prefers-reduced-motion` (handled globally in `app.css`).
- Ensure Chinese labels fit in controls on mobile and desktop; wrap layout
  before shrinking text.

## Forbidden Patterns

- Reintroducing Material 3 / `--md-sys-*` as the active visual system.
- Reintroducing the Material Symbols Rounded font or the
  `material-symbols-rounded` class.
- Adding Playwright for validation unless the user explicitly asks for it.
- Changing form field names, route paths, or query parameter contracts as
  part of visual work.
- Decorative blobs, gradient-only heroes, or abstract SVGs as primary
  public-page media.
- Introducing a second runtime CSS framework or UI library on top of
  Tailwind v4 + `bits-ui` without an explicit product/tooling decision.
- Treating `cn-division` as a class-merge utility — it is an administrative
  division dataset. Use `src/lib/utils.ts`'s `cn()` instead.

## Validation

- Run `corepack pnpm build`.
- Run `corepack pnpm lint` (prettier --check + eslint, including
  eslint-plugin-svelte and eslint-plugin-astro).
- Run `pnpm exec tsc --noEmit` for a type pass when `astro check` is not
  available.
- For visual-only frontend work, verify the diff does not include backend
  data, API, or database changes unless the task explicitly requested them.
