# Implementation plan

## 0. Preflight and baseline

- [ ] Read `prd.md`, `design.md`, both research notes and the updated frontend design-system spec context.
- [ ] Confirm only `.mcp.json`, `.vscode/*` and this task directory are dirty before product edits.
- [ ] Capture `git diff --stat` and current Flowbite/Tailwind import counts.
- [ ] Re-run `corepack pnpm build`, `corepack pnpm lint` and `corepack pnpm test` if the worktree changed after planning.
- [ ] Fetch `https://bits-ui.com/docs/llms.txt` again before writing wrappers and use installed `bits-ui@2.18.1` types to resolve any documentation drift.

Gate P0: baseline commands are green or any new external blocker is recorded before edits.

## 1. Add the new foundation beside the old stack

- [ ] Add `phosphor-svelte@3.1.0` with `corepack pnpm`.
- [ ] Add `src/styles/components.css` for shared semantic component classes and Bits UI data-state selectors.
- [ ] Rewrite `src/styles/tokens.css` to the approved warm editorial palette, density, radius, shadow, layer and motion tokens.
- [ ] Extend `src/styles/app.css` with the new vanilla base and reveal rules while temporarily retaining Tailwind imports for unmigrated pages.
- [ ] Change `src/lib/utils.ts` only after confirming whether callers still require Tailwind merge during the transition.
- [ ] Add a first Bits UI wrapper test that compiles against `Button.Root`, `Label.Root`, `Separator.Root`, `Checkbox.Root`, `Dialog`, `AlertDialog` and `Select`.

Gate G1: build, lint and test pass with both old and new foundations present.

## 2. Migrate shared primitives

- [ ] Rewrite `ui/button.svelte` on `Button.Root`; preserve anchor, disabled, variant, size, attribute forwarding and click contracts.
- [ ] Rewrite `ui/label.svelte` on `Label.Root`.
- [ ] Rewrite `ui/separator.svelte` on `Separator.Root`.
- [ ] Rewrite `ui/checkbox.svelte` on `Checkbox.Root`; preserve bindable checked state and form attributes.
- [ ] Rewrite `ui/confirm-dialog.svelte` on `AlertDialog`.
- [ ] Rewrite `ui/side-panel.svelte` on `Dialog`.
- [ ] Rewrite input, textarea, file upload, alert, card and table wrappers as semantic native elements with centralized classes.
- [ ] Replace Flowbite Spinner usage with a shared CSS spinner or progress state that respects reduced motion.
- [ ] Keep component props compatible unless `design.md` explicitly records a migration.
- [ ] Update coverage tests from Flowbite implementation assertions to Bits UI primitive and behavior assertions.

Gate G2: every shared wrapper builds, coverage tests pass and no wrapper imports Flowbite.

## 3. Migrate shared business components and shell

- [ ] Rewrite `SelectField.svelte` with Bits UI Select and preserve its existing public props.
- [ ] Verify `name`, `required`, `disabled`, initial value, prop sync, typeahead and callback behavior.
- [ ] Keep `DivisionPicker.svelte` and `CitySelector.svelte` data flow unchanged while replacing utility classes.
- [ ] Rewrite `TagInput.svelte` around Bits UI Combobox and preserve serialization, limits, debounce and draft submission.
- [ ] Rewrite public and admin mobile navigation with Dialog sheets.
- [ ] Rewrite `Layout.astro` and `AdminLayout.astro` using the new semantic shell classes and Phosphor icons.
- [ ] Preserve skip link, active routes, metadata, JSON-LD slot, reveal observers and admin identity.

Gate G3: build, lint and test pass. Public homepage and admin login render with the new shell.

## 4. Migrate homepage

- [ ] Recompose `HomepageContent.svelte` into the editorial split and asymmetric rankings.
- [ ] Preserve its single-snapshot ownership and prop initialization behavior.
- [ ] Replace Flowbite carousel internals in `FeaturedEventCarousel.svelte` while preserving autoplay, index reset, pause and controls.
- [ ] Use Bits UI Tabs for popularity windows with SSR anchor render delegation.
- [ ] Use ToggleGroup for the mobile scene selector.
- [ ] Replace Flowbite Spinner and ButtonGroup usage.
- [ ] Keep local/nationwide list DTO boundaries and cache keys unchanged.
- [ ] Verify dynamic snapshot replacement stays inside a stable reveal parent.

Gate G4: homepage source-contract tests, build, lint and test pass. Browser audit covers controls, navigation and region changes.

## 5. Migrate public browse and content routes

- [ ] Rewrite `FilterBar.svelte` with compact quick filters and Dialog-based advanced filters.
- [ ] Rewrite event list rows, event cards and artwork framing with semantic classes.
- [ ] Preserve full-row real links, image referrer policy and metadata.
- [ ] Rewrite `/events` without Flowbite PaginationItem and preserve all query parameters.
- [ ] Rewrite `/categories` with semantic taxonomy lists and existing tag links/counts.
- [ ] Rewrite `/events/[id]` using the editorial split and preserve JSON-LD, status, optional information and action links.
- [ ] Rewrite `/404` with the same public shell and real recovery links.

Gate G5: public routes build and return expected HTTP status. Query, JSON-LD and link tests pass.

## 6. Migrate submission

- [ ] Rewrite `SubmissionSection.astro` presentation while keeping required groups visible.
- [ ] Keep optional fields in native `details`.
- [ ] Replace all Flowbite form wrappers with final native/Bits wrappers.
- [ ] Preserve field names, visible `必填` labels, browser validation and Turnstile.
- [ ] Preserve POST `/api/submit`, inline errors, pending state and `/submit?sent=1`.
- [ ] Verify Select hidden inputs submit the expected names and values.

Gate G6: submission tests pass and browser form smoke checks cover validation, optional disclosure and no-JavaScript structure.

## 7. Migrate admin surfaces

- [ ] Rewrite admin route navigation to the compact top operational shell.
- [ ] Rewrite `AdminEventForm.astro` presentation without changing any field contract.
- [ ] Rewrite EventTable and Pagination using native table and real links.
- [ ] Rewrite EventActions with Bits AlertDialog and Phosphor icons.
- [ ] Rewrite TagMergeForm with Bits Select and AlertDialog confirmation.
- [ ] Rewrite BulkEventImport states, tables, warning checkboxes, focus movement and progress presentation.
- [ ] Rewrite `/admin`, `/admin/published`, `/admin/offline`, `/admin/tags`, `/admin/events/new`, `/admin/events/bulk`, `/admin/events/[id]/edit` and `/admin/login` wrappers.
- [ ] Preserve auth, API endpoints, reload, `next`, reject reason and no-tag guards.

Gate G7: admin-related tests, build, lint and test pass. Login and protected-route behavior are smoke tested.

## 8. Remove old stack and harden tests

- [ ] Remove all remaining Flowbite and Flowbite icon imports.
- [ ] Remove all Tailwind utility class syntax from Astro and Svelte templates.
- [ ] Remove Tailwind/Flowbite CSS directives from `app.css`.
- [ ] Remove Tailwind plugins from `astro.config.mjs` and `vite.config.js`; delete `vite.config.js` if empty.
- [ ] Remove Tailwind Prettier plugin configuration.
- [ ] Remove Flowbite, Tailwind, Tailwind forms, Tailwind Vite, Tailwind merge and Tailwind Prettier packages.
- [ ] Change `cn()` to `clsx` only and rename if useful.
- [ ] Rename `test/flowbite-component-coverage.test.ts` to a Bits UI contract test.
- [ ] Add negative assertions for banned dependencies and Tailwind variant syntax.
- [ ] Update `.trellis/spec/frontend/design-system.md` to the final implemented contract.

Gate G8: removal scans are zero, lockfile contains no direct old-stack dependency and the full automated suite passes.

## 9. Final verification

Run:

```bash
corepack pnpm format
corepack pnpm lint
corepack pnpm test
corepack pnpm build
rg -n 'flowbite|flowbite-svelte|flowbite-svelte-icons|tailwindcss|@tailwindcss|prettier-plugin-tailwindcss|tailwind-merge' package.json astro.config.mjs vite.config.js .prettierrc src test
rg -n 'class=.*(dark:|sm:|md:|lg:|xl:|2xl:|hover:|focus:|data-\\\[|\\\[&)' src --glob '*.astro' --glob '*.svelte'
```

Runtime:

```bash
./node_modules/.bin/astro dev --background --host 127.0.0.1 --port 4321
./node_modules/.bin/astro dev status
./node_modules/.bin/astro dev logs
./node_modules/.bin/astro dev stop
```

Check:

- [ ] `/`, `/events`, one existing `/events/[id]`, `/categories`, `/submit`, `/submit?sent=1`, `/404` and `/admin/login`.
- [ ] Expected redirects for protected admin routes.
- [ ] Homepage tabs, scene switch, carousel controls and region change.
- [ ] Catalogue quick/advanced filters and pagination retain query parameters.
- [ ] Select, Combobox, Dialog, AlertDialog, Tooltip and Checkbox keyboard operation.
- [ ] 390px mobile and desktop without horizontal page overflow.
- [ ] Light mode, dark mode and reduced motion.
- [ ] No repeated Svelte lifecycle error or browser console error.
- [ ] Final diff contains no backend, API, database or unrelated workspace changes.

## Rollback points

- R1: foundation only, before shared wrapper migration.
- R2: shared wrappers and shell, before route composition.
- R3: public routes complete, before admin migration.
- R4: full migration before dependency removal.
- Final rollback: revert task commits. No data migration rollback is needed.
