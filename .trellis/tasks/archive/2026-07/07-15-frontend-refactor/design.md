# Design - Frontend Refactor

## 1. Design Summary

The refactor keeps the current server/data architecture and replaces the
presentation composition. Public pages become cover-led, editorial event
surfaces; admin pages become a restrained operational workspace. Shared semantic
tokens and primitives keep the two surfaces related without making them look
identical.

The work remains one integration task because public and admin pages share the
same token and primitive changes. Implementation and validation are divided into
shared-system, public-site, and admin checkpoints.

## 2. Boundaries And Invariants

### Preserved

- Astro page routing, server frontmatter, D1 queries, and Cloudflare bindings.
- Public route, query, form, API, redirect, Turnstile, city-memory, and JSON-LD
  contracts listed in `prd.md`.
- Admin auth modes, `Astro.locals.admin`, edit/merge/moderation endpoints, and
  status semantics.
- Astro pages with focused Svelte islands; no SPA conversion.

### Changed

- Page markup, responsive composition, tokens, typography, and component visual
  variants.
- Filter disclosure and submission disclosure while preserving native form
  semantics.
- Admin queue responsive presentation and action feedback.

### Not Changed

- `src/lib/db/**`, migrations, core auth logic, and API business rules unless a
  rendering contract exposes a confirmed defect during implementation.

## 3. Visual System

### Public Direction

Use a refined ACG editorial language rather than a generic dashboard:

- Neutral near-white and near-black canvases carry most of the page.
- A magenta-red primary, cyan-teal secondary, and small yellow signal accent
  provide multi-hue energy without gradients or a one-note palette.
- Real event covers provide the dominant imagery. A generated raster fallback
  with no text, character likeness, or third-party marks handles missing media.
- Headlines use strong weight and controlled size; body and metadata remain
  compact and highly readable. Letter spacing stays `0`.
- Borders become separators and control affordances, not a frame around every
  section. Cards remain limited to repeated event items and genuine tools.
- Corners remain at or below 8px. Motion is short and functional and respects
  `prefers-reduced-motion`.

Target semantic token families in `src/styles/tokens.css`:

| Role         | Light direction                       | Dark direction                    |
| ------------ | ------------------------------------- | --------------------------------- |
| Canvas / ink | cool near-white / neutral ink         | neutral near-black / soft white   |
| Primary      | magenta-red with white foreground     | lighter rose with dark foreground |
| Accent       | cyan-teal                             | bright cyan-teal                  |
| Signal       | warm yellow used sparingly            | brighter yellow                   |
| Danger       | accessible red, separate from primary | accessible light red              |

Exact values are tuned in-browser for contrast; semantic names remain stable so
public and admin components do not depend on raw colors.

### Admin Direction

Admin pages reuse the same typography and tokens but emphasize neutral surfaces,
thin rules, compact density, stable column alignment, and explicit action
states. Expressive accents are reserved for status and priority, not decoration.

## 4. Shared Structure And Components

### Existing Primitives

Retain and refine `src/components/ui/*`. Extend only where a shared primitive
removes real duplication:

- `button.svelte`: consistent variants/sizes and support for needed native
  attributes.
- `badge.svelte`: public category, filter, and admin status tones.
- input/label/textarea/select/table primitives: one field and focus language.
- Dialog/AlertDialog wrapper: advanced filters and destructive confirmations.

Do not use cards as general page-section wrappers. `card.svelte` remains for
repeated items or framed tools only.

### New Or Reworked Business Components

- `EventArtwork.astro`: cover rendering, aspect-ratio control, eager/lazy mode,
  accessible alt text, and local raster fallback.
- `EventCard.astro`: `featured`, `row`, and `compact` variants using one event
  metadata contract.
- `FilterBar.svelte`: quick GET filters, advanced Dialog form, active-filter
  links, and reset behavior.
- `SubmissionSection.astro`: fieldset/details presentation for required and
  optional form groups without moving inputs out of the native form.
- `admin/EventTable.astro`: one semantic table whose rows become block task cards
  below the desktop breakpoint; no duplicate hidden table/card forms.
- `admin/EventActions.svelte`: existing moderation endpoints, pending/loading/
  error state, reject-reason dialog, and destructive confirmation.
- `AdminMobileNav.svelte`: accessible mobile navigation sheet while the desktop
  sidebar remains server rendered.

## 5. Public Page Composition

### Public Layout

`Layout.astro` owns document metadata, the recognizable Eventlist brand signal,
the three primary routes, and the shared footer. The header stays compact. On
mobile all three routes remain directly reachable without a marketing menu.

### Homepage `/`

1. Compact location context and change control.
2. Featured event stage using the first suitable upcoming cover and real event
   metadata over the media, with a direct detail action.
3. Upcoming compact list beginning within or immediately after the first
   viewport.
4. Type/tag discovery links as unframed bands below the main event content.

Remove the current statistics row. If no events exist, show a purposeful empty
state with catalogue and submission actions rather than an empty hero.

The existing `listPublishedEvents(..., pageSize: 8, sort: "start_asc")` result is
sufficient: prefer the first event with `cover_url` as featured, otherwise use
the first event and the local fallback. No query or API expansion is required.

### Catalogue `/events`

`FilterBar.svelte` renders:

- A quick GET form for location, type, and date.
- An advanced Dialog form for scale, tag, sort, and secondary date detail.
- Hidden current values so either form preserves the other filter group.
- Active-filter badges linking to URLs with one parameter removed.
- A full reset link to `/events`.

The result list uses cover thumbnails, date, location, category, and tags in a
scan-friendly row. Pagination continues to clone the current URL parameters.

### Detail `/events/[id]`

Use a wide real-cover stage with title, category, date, and location as the
first-viewport event signal. Below it, compose description, practical facts, and
ticket/source actions as an unframed main column plus a restrained action rail.
Offline and missing-event states remain explicit. JSON-LD is unchanged.

### Submission `/submit`

Keep the existing native form and fetch submission:

- Always visible: title/type/scale, region/venue/date, source/contact,
  Turnstile, result status, and submit action.
- Expandable optional section: tags, address, cover, description, QQ group, and
  ticket URL, grouped by meaning rather than by arbitrary step numbers.
- Use semantic `fieldset`, `legend`, and native `details` where possible. A
  capture-phase `invalid` handler opens an ancestor details element before the
  browser focuses an invalid control.
- Values remain in the DOM and FormData regardless of disclosure state.

## 6. Admin Page Composition

### Admin Layout

Desktop uses a persistent sidebar and compact top bar. Mobile uses a top bar with
an icon menu opening an accessible navigation sheet. Current path and admin
identity remain visible; content uses a bounded readable width without floating
page-section cards.

### Event Queues

Keep one `<table>` in `admin/EventTable.astro`:

- At `lg` and above it behaves as a compact aligned table.
- Below `lg`, hide the header and style each row as a task card; cells become
  labeled blocks and actions remain in document order.
- `EventActions.svelte` is mounted once per event and owns all action state. It
  submits the existing endpoint/method/FormData contracts and reloads after
  success.

### Tags, Edit, And Login

- Tags: compact merge tool above the tag inventory; destructive merge receives
  an explicit confirmation and inline error feedback.
- Edit: grouped dense form with a sticky save/action row; current PATCH endpoint
  and redirect remain unchanged.
- Login: quiet, centered authentication surface for token mode and a clear
  Access-mode status surface without pretending a local login action exists.

## 7. Responsive And Accessibility Contract

- Validate at approximately 390x844, 768x1024, and 1440x1000.
- Stable aspect ratios prevent media/layout shifts.
- Mobile controls use stable heights and full-width constraints where needed.
- Dialogs include title/description, focus trapping, Escape close, scroll lock,
  and visible close controls through `bits-ui`.
- Tables retain semantic markup even when rows are visually card-like.
- Focus, invalid, loading, destructive, empty, and error states never rely on
  color alone.
- External links retain safe `rel` values; cover alt text names the event.

## 8. Rollout And Rollback

Implement in four checkpoints: shared system, public discovery, public forms/
detail, and admin. Run type/lint/build checks after each checkpoint. The final
change contains no database migration and can be reverted as a frontend-only
commit. If the new disclosure component fails validation, the fallback is the
same fields rendered expanded; if media fails, the local raster fallback keeps
layout stable.
