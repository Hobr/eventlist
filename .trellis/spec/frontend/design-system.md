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
- Flowbite components emit their own `dark:bg-*`, `dark:text-*`, and
  `dark:border-*` utilities. Shared adapters must override those defaults with
  the matching semantic-token utility and Tailwind v4 important modifier, for
  example `dark:bg-surface!`. Verify the production CSS contains
  `background-color: var(--color-surface) !important`; source classes alone are
  not sufficient evidence.
- A caller that intentionally changes a Button variant's color must provide the
  equivalent explicit dark override. For example, a white control over event
  artwork uses `bg-white dark:bg-white!`, while a semantic inverse action uses
  `bg-foreground dark:bg-foreground!`. Without the caller override, the
  adapter's important dark variant correctly wins and silently changes the
  intended special-case color.
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
- Existing primitives: `button`, `badge`, `alert`, `checkbox`, `file-upload`, `card` + `card-header` /
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
- Button, Input, Textarea, Label, Card, Checkbox, and FileUpload adapters derive
  their public props from the matching Flowbite type and forward remaining
  native attributes. Preserve `id`, `name`, `href`, `target`, `title`, `aria-*`,
  `data-*`, validation attributes, and DOM event handlers instead of adding a
  local prop whitelist. Input/Textarea keep bindable `value`, Checkbox keeps
  bindable `checked`, and FileUpload keeps bindable `files` and `elementRef`.
- Repeated project contracts use `src/components/ui/` adapters. One-off
  structural composition may import Flowbite `ButtonGroup`, `Listgroup`,
  `ListgroupItem`, `PaginationItem`, `SidebarGroup`, or `SidebarItem` directly
  when the page still owns layout and business state.
- Visual warning, error, success, and neutral message containers use `ui/alert`.
  Compact inline validation and live-status text stays native when an Alert
  container would add incorrect visual weight.

### Approved Native Boundaries

- Keep page-level `form`, `nav`, `section`, `article`, and layout containers as
  semantic HTML. Flowbite does not own page information architecture.
- Keep public submission optional fields in native `details`, so fields remain
  reachable without JavaScript and retain browser validation.
- Keep hidden inputs, datalist elements, and the Turnstile response field native.
- The admin new-event page dynamically creates duplicate-warning confirmation
  checkboxes from a non-hydrated DOM script. Keep those checkboxes native so the
  existing `required` validation and rerender contract have one state owner.
- Keep EventCard `row` and `compact`, EventRow, public desktop three-column
  navigation, plain text links, and compact inline error/live status text native.
  Their specialized semantics are more specific than the available Flowbite
  component contract.
- Pagination uses standalone Flowbite `PaginationItem` links because the server
  exposes `page` and `hasNext`, not a total page count. Every item must retain a
  real SSR `href`.

## Business Components

- `SelectField.svelte` is the shared Flowbite native `Select` wrapper. Preserve
  its real `<select>` form behavior and prop contract when restyling:
    - `name`, `label`, `value`, `options`, `placeholder`, `required`,
      `showRequiredIndicator`, `disabled`, `wide`, `onchange`.
  `showRequiredIndicator` is opt-in and only adds visible `必填` copy; callers
  must pair it with an actually required field instead of changing validation.
- `DivisionPicker.svelte`, `CitySelector.svelte`, and `FilterBar.svelte`
  depend on `SelectField.svelte`; visual changes must keep URL query names
  and hidden form field behavior intact. `CitySelector.navigateOnChange=false`
  is the homepage-only controlled mode: province/city/county changes report a
  draft value without navigation or preference writes. `NavLocationPicker.svelte`
  owns the explicit “应用地区” request, and writes `eventlist.divisionCode` only
  after a complete homepage snapshot succeeds. The default `CitySelector`
  behavior remains full navigation for other callers. `DivisionPicker.showRequiredIndicator`
  marks the composed region label once; do not repeat `必填` on province, city,
  and county.
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
- `HomepageContent.svelte` is the single hydrated owner of the featured Hero and dual-intent popularity snapshot. `NavLocationPicker.svelte` may commit only one validated `HOMEPAGE_DATA_EVENT`; do not add independent per-section requests or an SSR-visible module-level store.
- `HomepageContent.svelte` and `NavLocationPicker.svelte` treat Astro props as one-time initial state. Wrap those `$state` initializers in `untrack(() => initialProp)` so the intent is explicit and the Svelte dev compiler does not emit `state_referenced_locally`; `HomepageIntentFeed.svelte` receives live parent snapshots and must retain its prop-signature sync effect.
- `FeaturedEventCarousel.svelte`, `HomepageIntentFeed.svelte`, and `HomepageRankedList.svelte` receive only explicit homepage public DTOs from `src/lib/public/homepage.ts`; never pass hydrated components a complete D1 event row or internal ranking type because Astro serializes client-island props.
- `FeaturedEventCarousel.svelte` owns the whole Hero surface. Multiple candidates use Flowbite Svelte Carousel/Controls/Indicators; one or zero candidates render no carousel controls. A changed division/candidate snapshot resets index, pause state, and the previous autoplay lifecycle.
- Flowbite Carousel ships its own `xl` / `2xl` height utilities, so the homepage Hero must explicitly override both breakpoints instead of relying only on an `lg` height. A native shell owns hover/focus/keyboard listeners, and each autoplay tick also checks `:hover` plus `document.activeElement` so component prop forwarding or programmatic focus cannot bypass the pause contract.
- `HomepageIntentFeed.svelte` progressively enhances one real-link `3 / 7 / 30` control for all four lists. It may import Flowbite `Spinner` as a stateless leaf, while project Tailwind tokens own the segmented layout. Successful snapshots are cached only by `city:window`; a division prop change aborts/invalidates the previous request before committing the new snapshot.
- `HomepageRankedList.svelte` owns one compact local or nationwide ordered list and accepts only `PublicHomepageRankedEvent[]`. `EventRow.svelte` remains the shared catalogue row contract through `EventCard.astro variant="row"`; do not reuse it for the intent ranking where timing emphasis and heat columns differ.
- Keep action buttons icon+text where the icon clarifies the command
  (Flowbite Svelte Icons).

## Interaction And Form Contracts

- Public `data-reveal` motion is progressively enhanced by `Layout.astro`.
  Content is visible by default; the inline head script adds `reveal-ready`, and
  the body script reveals each item once through `IntersectionObserver` before
  unobserving it. Only `opacity` and `transform` may animate. The global
  `prefers-reduced-motion` rule must force reveal content visible.
- `Layout.astro` must also register dynamically inserted `[data-reveal]` nodes
  through its shared `MutationObserver`; an initial `querySelectorAll()` alone
  leaves Svelte-created content permanently at `opacity: 0`. For keyed or
  conditional homepage surfaces such as `FeaturedEventCarousel`, place
  `data-reveal` on a stable parent that survives snapshot replacement instead
  of on the zero/single/multiple candidate roots. Do not add an `out:`
  transition that keeps an obsolete keyed Hero in layout after the new
  snapshot is ready.

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
  nearby section, or the old independent popularity/today sections below the Hero.
- 首页地区侧栏中的省, 市, 区县只修改待应用值. 有效 `应用地区` 成功后, 导航标签, Hero, 未开票/未结束四榜, URL, history 元数据和地区偏好才一起提交; 加载或失败期间继续显示旧快照, 并提供目标 URL 的普通导航回退.
- 主动地区切换使用 `history.pushState`，已保存地区恢复和热门窗口切换使用 `replaceState`，且必须合并保留已有 `history.state` 字段。`popstate` 无刷新请求对应完整快照；恢复失败时使用普通导航重新建立 URL 与内容一致性。
- At `sm` and wider, the public navigation capsule uses three balanced columns:
  brand at the left, `首页 / 活动 / 分类 / 投稿` geometrically centered, and the
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
- Homepage sections render in this order: featured Hero, then one unframed
  dual-intent feed. Do not render the deleted standalone popularity or today
  sections after it.
- At `lg` and wider, the intent feed always uses two stable columns: `未开票` on
  the left and `未结束` on the right, separated by one vertical rule. Each scene
  stacks `本地热门` and `全国热门`; do not create four narrow columns or nested
  cards.
- Below `lg`, the hydrated segmented control order is `未结束 / 未开票`, defaults
  to `未结束`, and changes only local UI state. Before hydration and without
  JavaScript, both scene sections remain in normal document flow and every event
  link stays reachable.
- One stable `3 / 7 / 30` control defaults to seven days, preserves the selected
  city, and updates all four lists together. The initial window is server-rendered.
  Hydrated clicks fetch uncached `city:window` combinations from `/api/popularity`,
  cache successful snapshots for the page lifetime without crossing division
  boundaries, retain the current four-list snapshot while loading/failing, and
  update `city`, `trend`, and `#intent-feed` with `history.replaceState` only after
  success. Real hrefs preserve full-navigation behavior without JavaScript.
  Abort or ignore stale requests so rapid selection cannot commit an older response.
- Each local/nationwide list renders at most five compact rows with stable rank,
  title, scene timing/status, region, activity schedule, and tabular heat columns.
  `未开票` emphasizes known admission date/time or `时间待定`; `未结束` shows
  `进行中` for started activities and the start schedule otherwise.
- Do not lead with statistics, feature marketing, or narrative copy
  ("command / dossier / radar / LIVE PREVIEW").
- Event browsing uses compact cover-led rows. Keep common filters directly
  visible and move advanced conditions to the accessible side panel; do not
  expose every control at equal weight or return to a three-column card grid.
- Event details use a wide stable-ratio media stage followed by date/region/
  venue facts, an unframed description column, and a restrained action rail.
  Offline and missing-event states stay explicit. Known event times appear in
  cards/details and JSON-LD; null historical times keep date-only output.
- Event-detail optional values use
  `getEventDetailOptionalContent(event: EventDetailOptionalFields)`: trim
  `description`, `address`, `qq_group`, both URLs, organizer, price range, and
  admission-start values, then
  treat `null`, empty, and whitespace-only results as absent. Empty values must
  not leave headings, wrappers, columns, or dividers. Normalize valid HTTP(S)
  URLs with `new URL(...).toString()` before comparison: distinct ticket and
  source URLs render as separate actions, while equal normalized URLs keep only
  the ticket action. Source data is never JSON-LD organizer data; a non-empty
  `organizer` field emits `Organization.name` and an empty one omits the entire
  organizer object.
- Detail facts always show one Beijing-time-derived user status, formatted
  `updated_at`, and the separate 30-day anonymous visitor count including zero.
  `offline`, `cancelled`, and `postponed` override date-derived status in that
  order. Optional organizer, admission method, price range, and admission start
  date/time share the action rail and use break-safe text without empty `<dl>`
  wrappers. Regression tests cover URL equality/difference, status boundaries,
  time formatting, all-empty/partial optional fields, and JSON-LD omission.
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
- The current installed TypeScript 7 / `@typescript-eslint/parser` toolchain
  loads the project ESLint configuration successfully. Treat
  `corepack pnpm lint` as a required gate: diagnose any future failure against
  the installed versions and source diff instead of applying the historical
  parser exception. Do not downgrade TypeScript or patch dependencies merely
  to suppress a lint failure.
- Validate public routes and `/admin/login` at approximately 390x844,
  768x1024, and 1440x1000. Assert `scrollWidth <= clientWidth`, stable media
  dimensions, focusable disclosure/dialog controls, and visible workflow
  states. For normal text, token foreground/background pairs must reach at
  least 4.5:1 in both color schemes.
- For homepage intent-feed changes, verify SSR contains both scene headings,
  `/api/homepage` and `/api/popularity` expose the same nested four-list shape,
  repeated requests remain 200, and a seeded Hero response includes only
  requested-region `division_code` values. Do not introduce Playwright solely
  for this check.
- For visual-only frontend work, verify the diff does not include backend
  data, API, or database changes unless the task explicitly requested them.
