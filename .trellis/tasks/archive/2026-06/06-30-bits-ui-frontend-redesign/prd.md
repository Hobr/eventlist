# Bits UI frontend redesign

## Goal

Rebuild the existing Eventlist frontend presentation around a Bits UI-style headless component system while preserving the current routes, data loading, forms, and moderation workflows.

The redesign should make the public ACG event directory feel like a focused browsing tool: dense enough to scan events quickly, polished enough for public use, and consistent between public pages and the admin surfaces.

## Confirmed Facts

- The app is an Astro project with Svelte islands and already depends on `bits-ui`.
- `SelectField.svelte` already wraps `bits-ui` `Select` and is used by public filters, submit form fields, region pickers, and admin forms.
- Public pages include `/`, `/events`, `/events/[id]`, and `/submit`.
- Admin pages use `AdminLayout.astro` plus shared admin table, pagination, and form styles.
- Business behavior must stay intact: published event listing, city persistence, filters in URL query params, detail JSON-LD, submission via `/api/submit`, Turnstile, and admin authentication.
- The current design-system spec says Material Design 3, but the latest user request supersedes the visual direction for this task: use Bits UI component-library style.

## Requirements

- Replace the existing frontend visual system with a new tokenized Bits UI-inspired system.
- Preserve all existing business routes, form field names, server actions, query parameters, and client behavior.
- Redesign public layout, navigation, hero, event cards, list filters, detail view, empty/error states, pagination, and submit form.
- Redesign admin shell, tables, login, buttons, form controls, status chips, and pagination so the backend UI no longer looks like the old frontend.
- Keep `bits-ui` as the interactive component foundation for select controls and style related primitives with shared `bits-*` classes.
- Use handwritten CSS and Astro/Svelte components already present in the repo; do not introduce Tailwind, Playwright, or a new frontend framework.
- Maintain responsive layouts for mobile and desktop without viewport-scaled fonts.
- Keep text readable in Chinese, avoid overlapping controls, and keep cards at 8px radius or less unless a component needs a smaller radius.
- Use icons in action buttons where meaningful and keep existing Material Symbols import unless a future task replaces iconography.

## Acceptance Criteria

- [ ] Public pages render with the new Bits UI-inspired design and no old Material 3 visual shell remains.
- [ ] Admin pages render with the same redesigned token system and remain usable for review workflows.
- [ ] `/`, `/events`, `/events/[id]`, `/submit`, and `/admin/login` preserve route behavior and form/query contracts.
- [ ] Existing `SelectField`, `DivisionPicker`, `CitySelector`, and `FilterBar` still work with the redesigned styles.
- [ ] `corepack pnpm build` passes.
- [ ] `corepack pnpm lint` is attempted; any unrelated existing blocker is documented.

## Out of Scope

- Database schema changes.
- API changes.
- New event fields, moderation states, or hotness logic.
- Replacing Material Symbols with a different icon library.
- Adding Playwright or browser E2E tooling.
