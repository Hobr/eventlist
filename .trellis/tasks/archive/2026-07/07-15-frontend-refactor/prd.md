# Frontend Refactor

## Goal

Rebuild the complete Eventlist frontend into an expressive but refined ACG event
discovery product and an efficient moderation workspace. The result must feel
distinctive, clear, and easy to use on desktop and mobile while preserving all
existing business contracts.

## Background

Eventlist already uses Astro 7, Svelte 5 islands, Tailwind CSS v4, `bits-ui`
2.18, Lucide icons, and semantic design tokens. Several previous redesigns
standardized that stack, but the current pages still give most sections the same
bordered-card treatment. The resulting hierarchy is weak: the homepage reads as
a collection of utility blocks, the catalogue exposes every filter at once, the
event detail fragments key facts, and submission is a long always-expanded form.
This task changes those compositions while retaining the established stack and
behavioral contracts.

## Requirements

### Product Scope

- **R1 - Coherent redesign:** Apply one visual and interaction system across the
  complete frontend scope, with separate public and admin compositions built on
  shared tokens and primitives.
- **R10 - Full route scope:** Redesign `Layout.astro`, `AdminLayout.astro`, and
  all public routes (`/`, `/events`, `/events/[id]`, `/submit`) and admin routes
  (`/admin`, `/admin/published`, `/admin/offline`, `/admin/tags`,
  `/admin/events/[id]/edit`, `/admin/login`).
- **R4 - Functional continuity:** Preserve the current user-facing workflows and
  server behavior unless this PRD explicitly changes the presentation.
- **R9 - Stable contracts:** Preserve route paths, catalogue query parameters,
  form field names, API endpoints, JSON-LD, Turnstile, admin authentication, and
  `localStorage` key `eventlist.divisionCode`.

### Experience And Visual System

- **R2 - Usability first:** Make navigation, primary actions, and workflow state
  clear without explanatory feature copy.
- **R3 - Responsive quality:** Support mobile and desktop without horizontal
  page scrolling, overlap, clipping, unreadable text, or displaced actions.
- **R5 - Established primitives:** Continue using Astro, Svelte, Tailwind v4,
  the existing `bits-ui` wrappers, Lucide icons, semantic tokens, and `cn()`.
- **R6 - Accessible interaction:** Preserve semantic structure, keyboard access,
  focus visibility, sufficient contrast, reduced-motion behavior, and explicit
  loading, empty, error, success, disabled, and destructive states.
- **R7 - Strong hierarchy:** Reduce equal-weight cards. Use typography, spacing,
  imagery, rules, and restrained surfaces to separate primary content from
  metadata and secondary controls.
- **R8 - Domain-specific surfaces:** Optimize public pages for event discovery
  and inspection; keep admin pages quiet, dense, and efficient for repeated
  moderation work.
- **R11 - Refined ACG editorial identity:** Use real event imagery, confident
  editorial composition, expressive multi-accent color, and purposeful icons.
  Avoid generic SaaS composition, decorative clutter, marketing-style feature
  sections, gradient-only media, and visuals that compete with event content.

### Public Workflows

- **R12 - Discovery-first homepage:** Show current location context, one
  featured upcoming event, a concise upcoming-event list, and a direct path to
  the full catalogue. Actual event content must appear in the initial viewport.
- **R14 - Progressive event filtering:** Keep location, date, and type directly
  available. Put scale, tags, sort, and secondary date detail in an accessible
  advanced-filter surface. Show active conditions and a clear reset path while
  preserving all existing GET parameters.
- **R13 - Progressive single-page submission:** Keep one form and one submit
  action. Present required identity, time, location, source, and contact fields
  clearly; group optional public information into expandable sections without
  losing values or hiding validation failures.

### Admin Workflows

- **R15 - Responsive admin queues:** Render pending, published, and offline
  queues as dense tables at desktop widths and task-oriented cards on mobile.
  Both layouts must expose equivalent metadata and permitted actions from one
  semantic source rather than duplicate hidden forms.

## Technical Notes

- Catalogue parameters are `city`, `type`, `scale`, `tag`, `from`, `to`,
  `page`, and `sort`; filters remain shareable through the URL.
- Required submission fields are `title`, `type`, `scale`, `division_code`,
  `venue`, `start_date`, `end_date`, `source_url`, and `submitter_contact`.
  `address`, `cover_url`, `description`, `qq_group`, `ticket_url`, and `tags`
  are optional. `cf-turnstile-response` remains controlled by Turnstile.
- Existing moderation endpoints and field names remain unchanged, including
  `reject_reason`, tag merge `from`/`to`, and edit-form field names.
- Event covers are optional. Real `cover_url` media is preferred; a clearly
  generic local raster fallback may be used when no usable cover exists.
- No new runtime UI framework or browser end-to-end test framework is needed.
  The installed `bits-ui` version already exposes Dialog, AlertDialog,
  Collapsible, Select, and related primitives.

## Acceptance Criteria

- [x] **AC1 (R1, R10):** Both layouts, all four public pages, and all six admin
      pages use the new system; no route is intentionally left on the current
      presentation.
- [x] **AC2 (R4, R9):** Existing routes, query parameters, field names, API
      endpoints, redirects, JSON-LD, Turnstile behavior, authentication, and
      saved-city behavior remain intact.
- [x] **AC3 (R7, R11, R12):** The homepage initial viewport contains real event
      content and a discovery action, has a recognizable ACG editorial identity,
      and does not lead with marketing copy or low-value statistics.
- [x] **AC4 (R14):** Common filters are directly available; advanced filters are
      keyboard operable; active conditions are visible; apply, remove, reset,
      pagination, and shared URLs preserve the expected parameters.
- [x] **AC5 (R13):** Submission remains one form. Expand/collapse operations do
      not clear values, obscure invalid required fields, or prevent keyboard
      completion; success still redirects to `/submit?sent=1`.
- [x] **AC6 (R8, R15):** Admin queue rows become scan-friendly tables on desktop
      and task cards on mobile with equivalent status, schedule, location,
      provenance, edit links, rejection input, and moderation actions.
- [x] **AC7 (R3):** Validated mobile, tablet, and desktop viewports have no
      incoherent overlap, clipping, accidental horizontal scrolling, or text
      outside its container.
- [x] **AC8 (R6):** Navigation, selects, dialogs, expandable sections, forms, and
      actions work with keyboard input, visible focus, semantic labels, and
      appropriate state feedback.
- [x] **AC9 (R2, R6):** Loading, empty, error, success, disabled, and destructive
      states are visually clear on every workflow that exposes them.
- [x] **AC10 (R4, R5):** Type checks, lint/format checks, production build, HTTP
      route smoke checks, and focused browser workflow checks pass.
- [x] **AC11 (R3, R7, R11):** Desktop and mobile browser screenshots confirm
      coherent hierarchy, correctly framed media, readable text, and responsive
      public/admin layouts.

## Out Of Scope

- Database schema or migration changes.
- Backend business-rule changes unrelated to a presentation contract.
- Replacing Astro, Svelte, Tailwind, or `bits-ui`.
- Saved filters, bulk moderation, accounts, notifications, or other new product
  capabilities.
- Adding Playwright or another browser end-to-end test framework.
