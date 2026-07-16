# Replace Event Type and Scale Tables with Shared Constants

## Goal

Simplify the event taxonomy contract by replacing the nearly immutable `event_types` and `event_scales` D1 dimension tables with one shared TypeScript catalogue, without changing user-visible choices or weakening write-time validation.

## Background

- The initial migration currently creates and seeds both dimension tables, and `events.type` / `events.scale` reference them through foreign keys (`migrations/0001_init.sql:3-15`, `migrations/0001_init.sql:87-88`, `migrations/0001_init.sql:124-138`).
- Every event read joins both tables for display labels, while option lists issue separate D1 queries (`src/lib/db/queries.ts:104-115`, `src/lib/db/queries.ts:219-230`).
- The public submit API queries both tables to validate submitted values (`src/pages/api/submit.ts:30-34`). The admin form currently relies on database rejection instead of explicit application validation (`src/lib/admin/form.ts:41-45`).
- `src/lib/db/index.ts:10-26` already contains unused code-only `TYPES` and `SCALES` objects, but they do not provide labels, ordering, or validators.
- The project is still on its pre-production single-file D1 baseline. Repository policy requires rewriting `migrations/0001_init.sql`, not adding a follow-up migration (`.trellis/spec/backend/database-guidelines.md:11-12`, `.trellis/spec/backend/database-guidelines.md:51-59`).

## Requirements

- R1. Preserve the existing eight type codes, four scale codes, Chinese labels, and display order exactly.
- R2. Define types and scales once in a shared `src/lib/events/` TypeScript module usable by Astro pages, Svelte components, form parsers, and server routes.
- R3. Export narrow `EventType` / `EventScale` types, membership validators, and label lookup helpers from the shared module.
- R4. Public submission and admin edit parsing must explicitly reject unknown type or scale values before attempting a D1 write.
- R5. Rewrite the single baseline migration so `event_types` and `event_scales` are never created or seeded. Preserve database integrity with `CHECK` constraints on `events.type` and `events.scale` containing the same allowed codes.
- R6. Remove D1 option-list queries and type/scale joins. All UI option lists and display labels must come from the shared catalogue.
- R7. Preserve all unrelated event, tag, audit, filtering, submission, moderation, and rendering behavior.
- R8. Update the executable backend database specification to describe the new schema, validation contract, and fresh-baseline checks.
- R9. Do not apply migrations to the configured remote D1 database as part of this task.

## Acceptance Criteria

- [x] AC1. A fresh baseline contains only the application tables `tags`, `events`, `event_tags`, and `audit_logs`; `event_types` and `event_scales` do not exist, and only `0001_init.sql` is recorded as a migration.
- [x] AC2. D1 accepts every preserved type/scale code and rejects unknown codes through `CHECK` constraints.
- [x] AC3. Public submission and admin editing reject unknown type/scale values with explicit validation errors, without querying dimension tables.
- [x] AC4. Home discovery, event filters, submission form, admin edit form, event cards, event detail, and admin event rows show the same labels in the same order as before.
- [x] AC5. Application code contains no SQL references to `event_types` or `event_scales`, no `listTypes` / `listScales` D1 helpers, and no duplicate code-only `TYPES` / `SCALES` definitions in the database module.
- [x] AC6. The existing public-site seed applies to a fresh database and still produces five events and four canonical tags.
- [x] AC7. Existing D1 schema constraints and indexes unrelated to type/scale dimensions remain intact.
- [x] AC8. Formatting, equivalent full-repository ESLint, TypeScript, and production build gates pass; see the implementation verification note for the pre-existing `pnpm lint` launcher incompatibility.
- [x] AC9. Backend database guidelines match the implemented source-of-truth and validation model.

## Out of Scope

- Administrator-configurable event types or scales.
- Changing codes, labels, ordering, or adding localization.
- Adding a second migration file or upgrading an already-deployed remote database.
- Refactoring tags, status values, administrative divisions, or other event fields.
