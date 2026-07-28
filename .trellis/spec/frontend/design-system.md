# Design System: Flowbite Svelte + Tailwind v4 Frontend

> The project's visual language for public and admin frontend work.

---

## Source of Truth

- **Component direction**: Flowbite Svelte visual and interactive components,
  exposed through small local compatibility adapters where the project already
  owns a stable component contract. Tailwind CSS v4 utilities and the `cn()`
  helper continue to own project-specific layout and semantic-token styling.
- **Implementation**: Astro pages + Svelte islands (Svelte 5 runes).
- **Style layer**: Tailwind CSS v4 via `@tailwindcss/vite`, plus
  `flowbite/plugin` and explicit `@source` entries for `flowbite-svelte` and
  `flowbite-svelte-icons`. No handwritten component CSS; layout and visual
  overrides live in Tailwind utility classes. `@theme inline` in
  `src/styles/app.css` bridges the semantic tokens defined in
  `src/styles/tokens.css` into Tailwind utilities (`bg-background`,
  `text-foreground`, `border-border`, `bg-primary`, ...).
- **Interactive primitives**: `flowbite-svelte`. Shared Button, Badge, Table,
  Drawer, and Modal behavior stays behind typed adapters in
  `src/components/ui/`; `SelectField.svelte` owns the shared business-select
  contract. Business components may import a stateless leaf such as `Spinner`
  directly when no shared adapter contract exists. Do not import Flowbite's DOM
  runtime, call `initFlowbite()`, or add data-attribute initialization.
- **Class merge utility**: `src/lib/utils.ts` exports `cn(...)` built on
  `clsx` + `tailwind-merge`. NOTE: the `cn-division` package is a China
  administrative-division dataset, NOT a class-merge utility — do not confuse
  the two.
- **Icons**: `flowbite-svelte-icons`, imported by named outline export from the
  package in both Astro and Svelte components. Decorative icons keep
  `aria-hidden`; icon-only controls get their accessible name from the owning
  button. Use Flowbite `Spinner` for loading state. The Material Symbols Rounded
  font is removed; do not reintroduce it or hand-write replacement SVGs.
- **Token source**: `src/styles/tokens.css` defines the shared visual tokens
  and is consumed by `app.css`'s `@theme inline` block. `app.css` also holds
  the minimal base reset (box-sizing, body font, focus-visible ring,
  prefers-reduced-motion).

## Token Contract

- The self-hosted primary font is `@fontsource-variable/geist` via
  `@fontsource-variable/geist/wght.css`. `--font-sans` starts with
  `"Geist Variable"`, then falls back through the project's Chinese system-font
  stack. Do not restore `Inter` as the preferred font or fetch runtime webfonts.
- Use semantic custom properties in `src/styles/tokens.css`:
    - colors: `--color-background`, `--color-foreground`, `--color-surface`,
      `--color-surface-subtle`, `--color-surface-raised`, `--color-border`,
      `--color-border-strong`, `--color-primary`, `--color-primary-foreground`,
      `--color-primary-subtle`, `--color-accent`, `--color-danger`, etc.
    - shape: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-full`.
    - motion: `--duration-fast`, `--duration-medium`, `--duration-reveal`,
      `--ease-standard`.
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

- Public pages use the shared cool-neutral surfaces, graphite foreground,
  raspberry brand signal, and real event media. Homepage and detail layouts may
  use generous editorial spacing and asymmetric composition, while catalogue
  and form pages remain scan-oriented.
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
- Wrap shared stateful Flowbite primitives under `ui/` so focus, overlay,
  title/description, close behavior, variants, and project token overrides have
  one owner. Reuse the existing Button, Badge, Table, SidePanel, and
  ConfirmDialog adapters instead of importing those Flowbite components in
  pages. Add non-interactive primitives when a visual pattern repeats across
  3+ pages. Avoid a second runtime UI library (shadcn-svelte CLI bundles,
  daisyUI, etc.); the `ui/` layer is hand-maintained.
- Keep `ui/` components free of business field semantics (no `event`,
  `division`, etc.).

## Business Components

- `SelectField.svelte` is the shared Flowbite native `Select` wrapper. Preserve
  its real `<select>` form behavior and prop contract when restyling:
    - `name`, `label`, `value`, `options`, `placeholder`, `required`,
      `showRequiredIndicator`, `disabled`, `wide`, `onchange`.
  `showRequiredIndicator` is opt-in and only adds visible `必填` copy; callers
  must pair it with an actually required field instead of changing validation.
- `DivisionPicker.svelte`, `CitySelector.svelte`, and `FilterBar.svelte`
  depend on `SelectField.svelte`; visual changes must keep URL query names
  and hidden form field behavior intact. `NavLocationPicker.svelte` reuses
  `CitySelector` inside `SidePanel` and restores `eventlist.divisionCode` from
  its own always-mounted island, because Flowbite may not mount drawer content
  until the panel opens. `DivisionPicker.showRequiredIndicator` marks the
  composed region label once; do not repeat `必填` on province, city, and county.
- `DivisionPicker.svelte` labels its levels `省`, `市`, `区/县`. The four
  municipalities expose one auto-selected city node; Chongqing must merge
  counties from both upstream city groups.
- `TagInput.svelte` is the admin canonical-tag editor. It keeps hidden
  `name="tags"` data joined by `、` and serializes the current draft too, so
  clicking Save directly after typing does not lose the new tag. Its opt-in
  `showRequiredIndicator` is presentation only because hidden inputs do not
  provide usable native required validation; the admin API remains authoritative.
- `admin/AdminEventForm.astro` owns the shared create/edit field composition.
  New and edit pages provide page-specific submit methods, busy/error copy,
  and redirects instead of duplicating event fields. Only the new page enables
  its `showRequiredIndicators` prop; the default remains `false` for edit.
- `EventCard.astro` and `admin/EventTable.astro` / `admin/Pagination.astro`
  consume `ui/` primitives, not raw Tailwind long-class strings.
- `FeaturedEventCarousel.svelte` and `HomepagePopularity.svelte` receive only explicit homepage public DTOs from `src/lib/public/homepage.ts`; never pass hydrated components a full `EventRecord` or `PopularEvent` because Astro serializes client-island props.
- `FeaturedEventCarousel.svelte` owns the whole Hero surface. Multiple candidates use Flowbite Svelte Carousel/Controls/Indicators; one or zero candidates stay server-only and render no carousel runtime or controls.
- Flowbite Carousel ships its own `xl` / `2xl` height utilities, so the homepage Hero must explicitly override both breakpoints instead of relying only on an `lg` height. A native shell owns hover/focus/keyboard listeners, and each autoplay tick also checks `:hover` plus `document.activeElement` so component prop forwarding or programmatic focus cannot bypass the pause contract.
- `HomepagePopularity.svelte` progressively enhances real `3 / 7 / 30` links. It may import Flowbite `Spinner` as a stateless leaf, while project Tailwind tokens own the three-segment layout.
- Keep action buttons icon+text where the icon clarifies the command
  (Flowbite Svelte Icons).

## Interaction And Form Contracts

- Public `data-reveal` motion is progressively enhanced by `Layout.astro`.
  Content is visible by default; the inline head script adds `reveal-ready`, and
  the body script reveals each item once through `IntersectionObserver` before
  unobserving it. Only `opacity` and `transform` may animate. The global
  `prefers-reduced-motion` rule must force reveal content visible.

- Catalogue URLs own filter state. Preserve `city`, `type`, `scale`, `tag`,
  `from`, `to`, `starts`, `active`, `page`, and `sort` whenever either the quick
  or advanced GET form is applied. Quick controls are location, type, and start
  date; scale, tag, sort, and end date belong in the `side-panel` surface.
  `starts` and `active` remain removable catalogue conditions. The homepage
  continuation CTA uses exactly `/events?city=<divisionCode>` so users arrive
  without a preselected date, type, scale, tag, or sort.
- Public submission remains one native `<form>`. Required controls are always
  visible: `title`, `type`, `scale`, `division_code`, `venue`, `start_date`,
  `end_date`, `source_url`, and `submitter_contact`. Optional `start_time` and
  `end_time` remain visible beside their dates and may be filled independently.
  Every required control has a visible Chinese `必填` label marker; do not rely
  only on color, an asterisk, placeholder text, or post-submit browser errors.
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
- Admin creation submits POST `/api/admin/events`, requires at least one
  canonical or newly entered tag, and redirects a successful 201 response to
  `/admin/events/:id/edit`. It does not include Turnstile and publishes
  immediately because the route is protected by admin middleware. The new-event
  page visibly marks its nine base required fields plus canonical tags with
  Chinese `必填`; the shared edit form does not enable these page-level markers.

## Public Page Structure

- Homepage first viewport is discovery-first: up to five ranked local recommendations, a
  compact homepage-only location trigger in the public navigation, and a
  catalogue action. Do not restore the large in-page location block, a separate
  nearby section, or redundant popular/today anchor buttons below the hero.
- At `sm` and wider, the public navigation capsule uses three balanced columns:
  brand at the left, `首页 / 活动 / 投稿` geometrically centered, and the
  homepage-only location trigger at the right. Mobile keeps brand plus the
  location trigger and menu without overlap or page-level horizontal scroll.
- Featured selection is compact and explainable. The whole rounded Hero is the
  card/slide surface; do not nest a recommendation card inside it. Candidates
  include already-started, not-ended activities plus future starts through the
  next 14 days, rank active candidates first, and display at most five.
- Multiple recommendations autoplay every six seconds and expose previous,
  next, indicators, and play/pause. Autoplay pauses for hover, focus, explicit
  user pause, or `prefers-reduced-motion`; one candidate has no timer or carousel
  controls. Cover failure falls back to `/images/event-fallback.webp` without
  changing Hero dimensions.
- Homepage sections render in this order: featured hero, popularity, then at
  most ten published local events whose date range covers the current
  China-local date. Today rows use `EventCard variant="row"`, preserve stable
  query order, and may repeat the featured event. The list or empty-state bottom
  border is the only separator before the catalogue CTA; do not add a second
  CTA top border.
- Popularity uses one stable three-segment `3 / 7 / 30` control, defaults to
  seven days, preserves the selected city, and updates local and nationwide
  lists together. The initial window is server-rendered. Hydrated clicks fetch
  uncached windows from `/api/popularity`, cache successful snapshots for the
  page lifetime, retain the current list while loading/failing, and update
  `city`, `trend`, and `#popular` with `history.replaceState` only after success.
  Real hrefs preserve full-navigation behavior without JavaScript. Abort or
  ignore stale requests so rapid selection cannot commit an older response.
  Each list renders at most five rows; use two equal columns on wide screens and
  a vertical flow on narrow screens.
- Do not lead with statistics, feature marketing, or narrative copy
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
- Both navigation surfaces expose `/admin/events/new` as `增加活动`; the new
  route owns its active state and must not activate the published queue item.
- 桌面和移动导航都必须暴露 `/admin/events/bulk` 为“批量导入”；该路由只激活自身，不得误激活“增加活动”或“已发布”。
- 批量导入使用单个 Svelte 状态流：客户端先通过共享解析器执行文件和记录限制，再请求服务端预览；提交时必须重新上传原文件。预览表格在小视口内自身横向滚动，不得扩张页面宽度。
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
- Auto-advancing content must also expose an explicit pause control and stop
  while focus is inside it; reduced-motion users must never receive an autoplay
  interval.
- Ensure Chinese labels fit in controls on mobile and desktop; wrap layout
  before shrinking text.

### Flowbite Dialog Focus Contract

Flowbite `Drawer` and `Modal` use native `<dialog>` plus a Svelte outro.
Changing bound `open` to `false` starts the outro before native dialog cleanup;
focusing the trigger synchronously can therefore be overwritten by the browser
and leave focus on `<body>`.

Shared adapters must capture the opening button, pass an explicit transition
duration to Flowbite, and restore focus only after that duration plus dialog
cleanup. The timeout and animation frame must be cancelled on reopen or
unmount, and the final callback must confirm that the surface is still closed
and the trigger is still connected. `SidePanel` must check its labelled native
`dialog` rather than assuming two animation frames are sufficient; background
tab throttling can delay Flowbite cleanup beyond the nominal transition.

```svelte
<script lang="ts">
    const TRANSITION_MS = 300;
    const transitionParams = { duration: TRANSITION_MS };
    let open = $state(false);
    let hasOpened = false;
    let triggerElement: HTMLButtonElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;

    function restoreAfterCleanup() {
        frame = undefined;
        if (open) return;
        const dialogIsOpen = [...document.querySelectorAll("dialog[open]")].some(
            (dialog) => dialog.getAttribute("aria-label") === title
        );
        if (dialogIsOpen) {
            frame = requestAnimationFrame(restoreAfterCleanup);
            return;
        }
        frame = requestAnimationFrame(() => {
            frame = undefined;
            if (!open && triggerElement?.isConnected) triggerElement.focus();
        });
    }

    function cancelRestore() {
        if (timer !== undefined) clearTimeout(timer);
        if (frame !== undefined) cancelAnimationFrame(frame);
        timer = undefined;
        frame = undefined;
    }

    $effect(() => {
        if (open) {
            hasOpened = true;
            return cancelRestore;
        }
        if (!hasOpened) return;
        hasOpened = false;
        timer = setTimeout(() => {
            frame = requestAnimationFrame(restoreAfterCleanup);
        }, TRANSITION_MS);
        return cancelRestore;
    });
</script>

<Drawer bind:open {transitionParams} />
```

Use this behavior through `ui/side-panel.svelte` and
`ui/confirm-dialog.svelte`; do not duplicate timers in business components.

> **Warning**: Flowbite Drawer renders its internal `Dialog` with
> `modal={false}`, even when the Drawer receives the visual `modal` prop. Native
> `<dialog>` therefore does not emit a cancel event for `Escape`. The shared
> `ui/side-panel.svelte` adapter must handle `Escape` on the Drawer, set its
> bound `open` state to `false`, and let the existing delayed focus restoration
> return focus to the opening button. Test `aria-expanded=false`, no open
> dialog, and `document.activeElement === trigger` after the 300ms outro.

```svelte
function handlePanelKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    open = false;
}

<Drawer bind:open onkeydown={handlePanelKeydown} />
```

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
  Tailwind v4 + Flowbite Svelte without an explicit product/tooling decision.
- Importing Flowbite's client DOM runtime, calling `initFlowbite()`, adding
  Flowbite data-attribute initialization, or introducing a manual `.dark`
  theme state. Svelte components own interaction and system media owns theme.
- Treating `cn-division` as a class-merge utility — it is an administrative
  division dataset. Use `src/lib/utils.ts`'s `cn()` instead.

## Validation

- Run `corepack pnpm test`.
- Run `corepack pnpm build`.
- Run `corepack pnpm lint` (prettier --check + eslint, including
  eslint-plugin-svelte and eslint-plugin-astro).
- Run `corepack pnpm exec tsc --noEmit` for a type pass when `astro check` is not
  available.
- Run `corepack pnpm exec prettier --check .` and `git diff --check`.
- Run `rg -n 'bits-ui|@lucide/(astro|svelte)' src package.json astro.config.mjs`;
  it must return no matches. Confirm `src/styles/app.css` retains
  `flowbite/plugin`, both Flowbite `@source` paths, and the system-media dark
  variant. Production source must not call `initFlowbite()`.
- The project currently uses TypeScript 7. `@typescript-eslint/parser` 8.64 is
  not yet compatible with TypeScript 7 and can fail while importing
  `eslint.config.js` before any project rule runs (for example, an internal
  Node assertion or a `typescript-estree` enum access error). Treat this as a
  known upstream tooling gap: continue to run Prettier, `tsc --noEmit`, and the
  production build, but do not downgrade TypeScript, patch dependencies, or
  change application code merely to make ESLint load. Re-enable the ESLint
  gate once the installed parser officially supports TypeScript 7.
- Validate public routes and `/admin/login` at approximately 390x844,
  768x1024, and 1440x1000. Assert `scrollWidth <= clientWidth`, stable media
  dimensions, focusable disclosure/dialog controls, and visible workflow
  states. For normal text, token foreground/background pairs must reach at
  least 4.5:1 in both color schemes.
- For visual-only frontend work, verify the diff does not include backend
  data, API, or database changes unless the task explicitly requested them.
