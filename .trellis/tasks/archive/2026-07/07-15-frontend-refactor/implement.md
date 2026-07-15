# Implement - Frontend Refactor

## 0. Preconditions

- [x] Load `trellis-before-dev` and the frontend design-system spec before code
      edits.
- [x] Confirm the worktree only contains this task's planning artifacts.
- [x] Record baseline results for `corepack pnpm lint`,
      `corepack pnpm exec tsc --noEmit`, and `corepack pnpm build`.
- [x] Start the server with `corepack pnpm astro dev --background` and retain
      baseline browser observations for `/`, `/events?city=110101`,
      `/events/1`, `/submit`, and `/admin/login`.

Baseline: TypeScript and production build pass. `pnpm lint` reaches Prettier and
fails only on the newly generated Trellis task/runtime JSON files; source lint
has no baseline failure.

## 1. Shared Visual System

- [x] Retune `src/styles/tokens.css` to the neutral + magenta-red + cyan-teal +
      signal-yellow semantic palette in `design.md`, including accessible dark
      values and distinct danger semantics.
- [x] Refine `src/styles/app.css` base rules without adding component-specific
      global CSS or viewport-scaled typography.
- [x] Generate and add one text-free local raster event-art fallback under
      `public/images/`; optimize it for web delivery.
- [x] Refine shared button, badge, input, label, textarea, separator, and table
      primitives; add a small Dialog/AlertDialog wrapper only where reused.
- [x] Add `EventArtwork.astro` and rework `EventCard.astro` variants with stable
      image dimensions, fallback behavior, and accessible media text.
- [x] Gate: run type and lint checks before changing page composition.

## 2. Public Shell And Homepage

- [x] Rework `src/layouts/Layout.astro` into the compact public shell while
      preserving metadata, favicon, JSON-LD injection, and active navigation.
- [x] Recompose `src/pages/index.astro` around location context, featured event,
      upcoming list, and lower type/tag discovery bands.
- [x] Remove the statistics row and equal-weight section-card pattern.
- [x] Cover the event, loading/error, and no-event homepage states.
- [x] Browser gate: inspect desktop/mobile first viewport, actual/fallback cover,
      nav reachability, text fit, and absence of horizontal overflow.

## 3. Catalogue Discovery

- [x] Rebuild `FilterBar.svelte` with quick and advanced GET forms, shared state,
      hidden preservation fields, active-filter removal links, and reset.
- [x] Use installed `bits-ui` Dialog semantics for the advanced surface; keep
      Select/DivisionPicker contracts intact.
- [x] Recompose `src/pages/events/index.astro` as an editorial result feed with
      cover thumbnails, result count, empty/error states, and current pagination.
- [x] Verify every supported query parameter individually and in combination;
      applying/removing/resetting filters and pagination must preserve expected
      URLs.
- [x] Browser gate: keyboard-open/close the advanced surface and verify mobile/
      desktop overflow and focus return.

## 4. Event Detail And Submission

- [x] Recompose `src/pages/events/[id].astro` around the event media stage,
      practical facts, description, actions, offline status, and missing state;
      leave data loading and JSON-LD unchanged.
- [x] Add the shared submission-section presentation and restructure
      `src/pages/submit.astro` into always-visible required groups plus optional
      progressive disclosure.
- [x] Preserve every submission field name, maxlength/type/required attribute,
      Turnstile mount, POST endpoint, inline result status, and success redirect.
- [x] Add invalid-control disclosure behavior and confirm optional values survive
      repeated open/close operations.
- [x] Browser gate: verify details with real/fallback cover and submission with
      keyboard-only disclosure, client validation, API error, and sent state.

## 5. Admin Workspace

- [x] Rework `AdminLayout.astro` and add the accessible mobile navigation sheet
      while preserving current-path and `Astro.locals.admin` behavior.
- [x] Convert `admin/EventTable.astro` to one semantic responsive table whose
      rows become mobile task cards below `lg` without duplicate hidden forms.
- [x] Add `admin/EventActions.svelte` for approve, reject reason, offline,
      republish, pending/loading/error feedback, and destructive confirmation;
      preserve all endpoint/method/FormData contracts.
- [x] Recompose pending/published/offline queue pages and pagination around the
      new table while preserving page-size/query behavior.
- [x] Rework `admin/tags.astro`, the edit page, and login for the new admin
      hierarchy; preserve tag merge, PATCH, redirect, and both auth modes.
- [x] Browser gate: validate table mode at desktop, task-card mode at mobile,
      action reachability, rejection input, confirmation, and inline errors. If
      local auth prevents queue rendering, validate authenticated pages through
      the available local auth mode plus source/HTTP contract checks.

## 6. Cross-Surface Verification

- [x] Run `corepack pnpm exec tsc --noEmit`.
- [x] Run `corepack pnpm lint`.
- [x] Run `corepack pnpm build` and distinguish application failures from any
      reproducible pristine workerd/environment failure.
- [x] Run HTTP smoke checks for all public routes, `/submit?sent=1`, catalogue
      query combinations, `/admin/login`, and expected unauthenticated admin
      redirects.
- [x] Inspect console/server logs for new Svelte, hydration, asset, and runtime
      errors; resolve warnings in touched components.
- [x] Verify route/query/form/API/auth/JSON-LD/localStorage contracts against the
      checklist in `prd.md`.
- [x] Capture browser screenshots at mobile, tablet, and desktop for homepage,
      catalogue, detail, submission, admin login, and an authenticated admin
      queue when locally available.
- [x] Check screenshot/DOM evidence for hierarchy, media framing, dark/light
      readability, keyboard focus, overlap, clipping, and horizontal overflow.

Browser note: public routes and `/admin/login` were checked at 390x844,
768x1024, and 1440x1000 with no horizontal overflow. Representative homepage
and admin-login screenshots were captured; the in-app screenshot surface timed
out on additional captures even though DOM inspection continued to pass. The
local admin binding is Cloudflare Access mode, so protected queue routes correctly
redirect to `/admin/login` without an available Access JWT. Queue rendering was
verified with a temporary localhost-only page containing fabricated records; the
page was removed immediately after desktop table, mobile task-card, navigation,
and reject-dialog checks. No real admin action or data mutation was performed.
Light and dark token pairs were also checked numerically; normal-text pairs now
meet or exceed 4.5:1.

Acceptance review: AC1-AC10 pass. AC11 passes on the captured homepage,
admin-login, and desktop/mobile admin-queue samples plus three-breakpoint DOM
measurements for every accessible route. The only evidence limitation is that
the in-app screenshot surface timed out on the remaining public-page captures;
the corresponding rendered pages and overflow/media dimensions were still
inspected in the real browser. Native `<summary>` focus and retained form values
were verified; the automation key injector did not consistently fire the
browser's native Enter activation, so no custom key handler was added on top of
the semantic control.

## 7. Review And Finish Gates

- [x] Run the PRD acceptance criteria top to bottom and record any exceptions.
- [x] Load `trellis-check` for the required full-scope quality pass.
- [x] Update `.trellis/spec/frontend/design-system.md` only with conventions
      proven by the implementation.
- [x] Review the final diff for accidental backend, generated-config, dependency,
      or local-runtime state changes before the commit phase.
