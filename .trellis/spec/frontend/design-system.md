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
- Public/admin HTML documents declare `<meta name="color-scheme" content="light dark">`
  so native controls follow the same system preference as semantic tokens.
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
  `table-body` / `table-row` / `table-head` / `table-cell`, `side-panel`, and
  `confirm-dialog`.
- Wrap every newly used `bits-ui` primitive under `ui/`, even for its first
  business use, so focus, overlay, title/description, and close behavior have
  one owner. Add non-interactive primitives when a visual pattern repeats
  across 3+ pages. Avoid a second runtime UI library (shadcn-svelte CLI
  bundles, daisyUI, etc.) — the `ui/` layer is hand-maintained.
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
- `DivisionPicker.svelte` labels its levels `省`, `市`, `区/县`. The four
  municipalities expose one auto-selected city node; Chongqing must merge
  counties from both upstream city groups.
- `TagInput.svelte` is the admin canonical-tag editor. It keeps hidden
  `name="tags"` data joined by `、` and serializes the current draft too, so
  clicking Save directly after typing does not lose the new tag.
- `EventCard.astro` and `admin/EventTable.astro` / `admin/Pagination.astro`
  consume `ui/` primitives, not raw Tailwind long-class strings.
- Keep action buttons icon+text where the icon clarifies the command
  (Lucide icons).

## Interaction And Form Contracts

- Catalogue URLs own filter state. Preserve `city`, `type`, `scale`, `tag`,
  `from`, `to`, `page`, and `sort` whenever either the quick or advanced GET
  form is applied. Quick controls are location, type, and start date; scale,
  tag, sort, and end date belong in the `side-panel` surface. Active conditions
  link to the same URL with exactly one parameter removed.
- Public submission remains one native `<form>`. Required controls are always
  visible: `title`, `type`, `scale`, `division_code`, `venue`, `start_date`,
  `end_date`, `source_url`, and `submitter_contact`. Optional `start_time` and
  `end_time` remain visible beside their dates and may be filled independently.
  Optional controls inside native `<details>` include `tag_suggestions`,
  `address`, `cover_url`, `description`, `qq_group`, and `ticket_url`. Visitor
  submissions never send canonical `tags`. Keep
  `cf-turnstile-response`, POST `/api/submit`, and success redirect
  `/submit?sent=1` unchanged.
- Admin moderation islands submit POST to
  `/api/admin/events/:id/{approve|reject|offline|republish}`. Rejection sends
  `reject_reason`; tag merge POSTs `from` and `to` to
  `/api/admin/tags/merge`; edit submits the existing event fields with PATCH to
  `/api/admin/events/:id`. Approve/republish are disabled and rejected by the
  API until at least one canonical tag exists. Actions expose pending,
  disabled, inline error, and destructive-confirmation states without
  duplicating hidden forms.

## Public Page Structure

- Homepage first viewport is discovery-first: current location controls, one
  featured upcoming event, a concise upcoming list, and a direct catalogue
  action. Do not lead with statistics, feature marketing, or narrative copy
  ("command / dossier / radar / LIVE PREVIEW").
- Event browsing uses compact cover-led rows. Keep common filters directly
  visible and move advanced conditions to the accessible side panel; do not
  expose every control at equal weight or return to a three-column card grid.
- Event details use a wide stable-ratio media stage followed by date/region/
  venue facts, an unframed description column, and a restrained action rail.
  Offline and missing-event states stay explicit. Known event times appear in
  cards/details and JSON-LD; null historical times keep date-only output.
- Public submission uses required fieldsets plus optional progressive
  disclosure inside one form. Inputs must never be moved out of the form or
  removed from the DOM when disclosure closes.

## Admin Page Structure

- Desktop uses a persistent sidebar and aligned table columns; mobile uses a
  compact top bar with the shared `side-panel` navigation.
- Each event queue owns exactly one semantic `<table>`. Below `lg`, keep the
  header in the DOM and style each `<tr>` as a task card; expose cell labels
  through `data-label`. Do not render separate desktop and mobile forms.
- Mount `admin/EventActions.svelte` once per row. Desktop and mobile therefore
  share the same status, schedule, location, provenance, edit link, rejection
  reason, confirmation, loading, and error behavior.
- If Cloudflare Access prevents local authenticated rendering, use fabricated
  records in a temporary localhost-only preview route for visual checks, then
  delete that route. Never weaken middleware or read/use real credentials just
  to capture a screenshot.

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
- Keep the installed TypeScript version inside `@typescript-eslint/parser`'s
  declared peer range. As of this spec update, parser 8.64 supports
  `>=4.8.4 <6.1.0`, so the project pins TypeScript `^6.0.3`; upgrading the
  compiler without checking this range makes ESLint fail during config import
  before any source rule runs.
- Validate public routes and `/admin/login` at approximately 390x844,
  768x1024, and 1440x1000. Assert `scrollWidth <= clientWidth`, stable media
  dimensions, focusable disclosure/dialog controls, and visible workflow
  states. For normal text, token foreground/background pairs must reach at
  least 4.5:1 in both color schemes.
- For visual-only frontend work, verify the diff does not include backend
  data, API, or database changes unless the task explicitly requested them.
