# Structural frontend redesign

## Goal

Redo the frontend at the page-structure level so it no longer feels like the previous version with a new skin.

The user explicitly reported that the previous Bits UI redesign did not create a large enough visible change. This follow-up must change first impression, page composition, browsing flow, and repeated component shape while preserving backend behavior.

## Confirmed Facts

- The current app is Astro + Svelte islands with `bits-ui` already installed.
- The previous task introduced a Bits UI-inspired token system and updated the design-system spec.
- The previous result retained too much of the old layout: image hero plus right-side city card, similar event card grid, similar list/detail/form composition.
- Public route contracts must remain stable: `/`, `/events`, `/events/[id]`, `/submit`.
- Admin routes and workflows must remain stable.
- The user wants a visibly larger frontend change, not another small style pass.

## Requirements

- Rework the public homepage first impression into a distinctly different product surface.
- Rework `/events` into a denser browsing workspace rather than the previous heading + filter card + grid pattern.
- Rework `/events/[id]` into a different information architecture with prominent facts and actions.
- Rework `/submit` so it no longer reads like the old two-column form with light CSS changes.
- Keep all existing data fetching, query params, form field names, API endpoints, Turnstile behavior, JSON-LD behavior, and admin auth behavior intact.
- Preserve the Bits UI-inspired token/control system from the previous task.
- Avoid Playwright and new frontend frameworks.
- Keep mobile layouts readable and prevent overlapping controls.

## Acceptance Criteria

- [ ] The homepage has a substantially new first viewport and information layout.
- [ ] The event listing page no longer resembles the old `page-heading + toolbar panel + three-column card grid` composition.
- [ ] The detail page has a visibly different layout and emphasizes core event facts differently from the old version.
- [ ] The submit page has a visibly different form organization while preserving field names.
- [ ] `corepack pnpm lint` passes.
- [ ] `corepack pnpm build` passes.
- [ ] No backend/API/database code is changed.

## Out of Scope

- Database or API changes.
- New event fields or moderation states.
- Replacing the current icon source.
- Adding Playwright or browser E2E tooling.
