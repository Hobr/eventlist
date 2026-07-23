# Implementation Plan

## Ordered Checklist

- [ ] Update the baseline audit action contract and query types to support
  `create` and define `createPublishedEvent` with candidate-ID retry, tag
  resolution, event-tag attachment, and audit insertion.
- [ ] Strengthen `parseEventForm` for strict dates and HTTP(S) URL validation,
  and enforce canonical tag count/length/non-empty rules for the new and
  existing admin forms.
- [ ] Extract the shared administrator event form from the existing edit page
  into a reusable Astro component that can render empty or populated values.
- [ ] Add `/admin/events/new` with server-side tag inventory loading and a
  browser `fetch` submit flow that redirects to the new event's edit page.
- [ ] Add authenticated `POST /api/admin/events` returning the new event ID,
  with 400 validation errors and 500 unexpected-error handling.
- [ ] Add the “增加活动” navigation item and plus icon to desktop/mobile admin
  navigation, preserving active-state behavior.
- [ ] Add focused local D1 verification for immediate publication, tag reuse,
  new-tag creation, alias resolution, duplicate-tag handling, missing-tag
  rejection, and rollback on a failed batch.
- [ ] Run `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`,
  `corepack pnpm build`, and route/API checks against a fresh local D1 state.

## Validation Commands

```bash
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build

tmp_dir=$(mktemp -d)
corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp_dir"
```

Use the generated local database to assert:

- a valid admin create returns `201` with an ID and stores `published` plus
  `published_at`;
- existing tags are reused case-insensitively and aliases attach to canonical
  IDs;
- new tags appear once in `tags` and are linked through `event_tags`;
- zero, overlong, or more-than-12 tags fail before a D1 write;
- a deliberately failing batch leaves no event, relationship, or audit row;
- unauthenticated `POST /api/admin/events` returns 401 JSON;
- public `/api/submit` still requires Turnstile and creates `pending` only.

## Risky Files And Rollback Points

- `migrations/0001_init.sql`: baseline contract; verify from an empty local
  persistence directory before any other route checks.
- `src/lib/db/queries.ts`: shared event/tag write path; compare public insert,
  admin edit, and moderation behavior after changes.
- `src/lib/admin/form.ts`: shared edit/new parser; preserve existing field names
  and verify both edit and create error messages.
- `src/components/admin/AdminEventForm.astro` and the edit page extraction:
  preserve populated edit values and hidden `tags` serialization before adding
  the empty-state page.
- `src/layouts/AdminLayout.astro` and `AdminMobileNav.svelte`: verify both
  desktop and mobile active navigation states.

If a validation gate fails, revert the last checklist group only after reading
the current diff; do not reset unrelated user changes.

## Review Gates Before Activation

- PRD has no unresolved product questions and records the immediate-publish
  decision.
- Design and implementation artifacts describe the same API, status, tag, and
  audit contracts.
- `implement.jsonl` and `check.jsonl` contain real project-spec entries.
- `task.py start` is run only after the user explicitly approves the final
  planning summary.
