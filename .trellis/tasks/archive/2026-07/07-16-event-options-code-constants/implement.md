# Implementation Plan

## 1. Establish the shared catalogue

- [x] Add `src/lib/events/options.ts` with the preserved ordered type and scale entries.
- [x] Derive `EventType` / `EventScale` union types and add membership and label helpers.
- [x] Remove the unused `TYPES` / `SCALES` objects from `src/lib/db/index.ts`.

## 2. Remove runtime D1 dimension dependencies

- [x] Update `EventRecord`, event inputs, and filter types where safe to use the shared unions.
- [x] Remove `OptionRow`, `listTypes`, and `listScales` from `src/lib/db/queries.ts`.
- [x] Remove `event_types` / `event_scales` joins and label columns from `EVENT_SELECT`.
- [x] Replace database option loading with shared arrays in home, event list, submit, and admin edit pages.
- [x] Replace `type_label` / `scale_label` rendering with shared label helpers in event cards, event detail, and admin event table.

## 3. Enforce server-side membership

- [x] Validate type and scale in `src/lib/public/form.ts` with user-facing Chinese errors.
- [x] Validate type and scale in `src/lib/admin/form.ts` with explicit errors.
- [x] Remove lookup queries and local `hasName` logic from `src/pages/api/submit.ts`.
- [x] Preserve the existing Turnstile, division, schedule, and HTTP error behavior.

## 4. Rewrite the pre-production D1 baseline

- [x] Remove dimension table definitions and seed statements from `migrations/0001_init.sql`.
- [x] Add exact allowed-code `CHECK` constraints to `events.type` and `events.scale`.
- [x] Confirm only one migration file exists.

## 5. Verify schema and behavior

- [x] Apply the baseline with Wrangler to a newly created temporary local persistence directory.
- [x] Query `sqlite_schema`, `d1_migrations`, `PRAGMA table_info(events)`, and `PRAGMA foreign_key_list(events)`.
- [x] Confirm valid type/scale inserts succeed and invalid values fail.
- [x] Apply `docs/dev/seed-public-site.sql`; assert five events and four canonical tags.
- [x] Search for stale SQL/table/helper/label-field references.
- [x] Run formatting plus an equivalent full-repository ESLint check with a TypeScript version inside the parser's supported peer range.
- [x] Run `corepack pnpm exec tsc --noEmit`.
- [x] Run `corepack pnpm build`.

## 6. Synchronize project knowledge

- [x] Update `.trellis/spec/backend/database-guidelines.md` through the Trellis spec-update workflow.
- [x] Re-run the relevant schema and project gates after any spec-driven correction.

## Verification Note

- `corepack pnpm lint` completes its Prettier phase but cannot start ESLint because the repository currently combines TypeScript 7.0.2 with `@typescript-eslint/parser` 8.64.0, whose declared peer range is `>=4.8.4 <6.1.0`. The parser crashes while loading `eslint.config.js` before inspecting source files.
- To verify the code without changing unrelated dependency work, the same repository ESLint rules were run with the already-installed parser instance bound to TypeScript 6.0.3. It checked 66 files with 0 errors and 0 warnings.

## Risk and Rollback Points

- Baseline validation must never reuse `.wrangler/state`; always use a fresh temporary directory.
- Do not run a remote D1 command.
- If any preserved seed or route fails, revert the catalogue/query/form changes together because they form one cross-layer contract.
- If the repository is discovered to have real applied migration history contrary to its spec, stop before deployment and redesign this as a forward migration.
