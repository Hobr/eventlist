# Technical Design

## Context

The current dimension tables carry no mutable business state beyond a stable code, Chinese label, and sort number. They add two joins to every event read and additional D1 calls to option-loading pages and submission validation. The approved direction is to model these values as application-owned enums while retaining database-level integrity.

Cloudflare D1 records applied SQL migrations in `d1_migrations`, and the repository's pre-production contract deliberately keeps one deterministic baseline. The implementation therefore rewrites `0001_init.sql` and validates it against a new isolated local persistence directory. It does not attempt to upgrade an old database or touch the remote binding.

Reference: https://developers.cloudflare.com/d1/reference/migrations/

## Shared Domain Catalogue

Create `src/lib/events/options.ts` as the only application catalogue for both dimensions.

It will export:

- Ordered immutable `EVENT_TYPES` and `EVENT_SCALES` arrays with `{ name, label }` entries.
- `EventType` and `EventScale` union types derived from the arrays.
- `isEventType(value)` and `isEventScale(value)` membership guards.
- `getEventTypeLabel(value)` and `getEventScaleLabel(value)` display helpers that fall back to the supplied code for defensive rendering.

Array order replaces the database `sort` column. The existing values and order remain unchanged. The unused `TYPES` and `SCALES` objects in `src/lib/db/index.ts` are removed so there is only one code definition in TypeScript.

## Validation Flow

Public and admin form parsers read raw string values, validate them with the shared guards, and only then return typed `SubmissionInput` / `AdminEventInput` values.

```text
FormData string
  -> required-field parsing
  -> shared type/scale membership guard
  -> EventType / EventScale
  -> D1 write
  -> events CHECK constraint
```

The public submit route no longer queries D1 for option membership. Turnstile, administrative-division validation, and insert behavior remain otherwise unchanged. Admin edits gain the same explicit type/scale validation instead of depending solely on a SQL constraint error.

## Read and Rendering Flow

`EVENT_SELECT` keeps the `events` and canonical-tag joins but removes the two dimension joins. `EventRecord` no longer exposes database-derived `type_label` or `scale_label` fields; its code fields use the shared union types.

Pages use the ordered catalogues directly for option lists. Event card, event detail, and admin table rendering use the shared label helpers. Unknown legacy values remain readable through the helpers' code fallback, although the rewritten baseline prevents new invalid values.

## Database Baseline

Rewrite `migrations/0001_init.sql`:

- Delete both dimension-table `CREATE TABLE` statements.
- Delete both seed `INSERT` blocks.
- Add explicit `CHECK (type IN (...))` and `CHECK (scale IN (...))` constraints to `events`.
- Remove the two dimension foreign keys.
- Keep `PRAGMA foreign_keys = ON` because tag aliases and `event_tags` still use foreign keys.
- Preserve all unrelated tables, checks, cascades, and indexes byte-for-byte where practical.

The allowed-code lists necessarily exist in both the SQL baseline and TypeScript catalogue because D1 migrations cannot import runtime TypeScript. Fresh-baseline constraint tests and the executable backend spec guard against drift.

## Compatibility and Operations

- This design is valid only under the repository's documented pre-production, no-deployed-history contract.
- Validation must use a fresh temporary `--persist-to` directory; an old local migration record would prevent a rewritten `0001_init.sql` from running.
- No remote D1 migration command is authorized.
- Rollback is a source-level revert of the migration and application changes before production deployment.

## Trade-offs

- Adding or renaming an option now requires a code deployment and a baseline/schema migration rather than a data edit. This is intentional for nearly immutable values.
- Dynamic administration and database-driven localization are unavailable. Neither exists in the current product scope.
- Removing joins and lookup queries simplifies runtime reads, at the cost of maintaining the SQL `CHECK` list alongside the TypeScript catalogue.
