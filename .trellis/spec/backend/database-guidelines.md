# Database Guidelines

> Database patterns and conventions for this project.

---

## Scenario: Foundation D1 Schema

### 1. Scope / Trigger

- Trigger: `foundation-db` establishes the project D1 database, base migrations, seed data, and shared access layer.
- D1 database: `eventlist-db`, binding `DB`, database id `b11ea70c-4597-4049-a650-718cfbc5b04f`.
- Base migrations must run before downstream admin/public features:
    - `migrations/0001_init.sql`: tables, foreign keys, status/date checks, indexes.
    - `migrations/0002_seed.sql`: `event_types`, `event_scales`, `cities`.
    - `migrations/0003_audit.sql`: admin audit log extension.

### 2. Signatures

- Wrangler config:
    - `wrangler.jsonc.d1_databases[0].binding = "DB"`
    - `database_name = "eventlist-db"`
    - `database_id = "b11ea70c-4597-4049-a650-718cfbc5b04f"`
    - `migrations_dir = "migrations"`
- Access helper: `await getDB(runtimeEnv): Promise<D1Database>`.
- FK helper: `await ensureFK(db)` executes `PRAGMA foreign_keys = ON;`.
- Generated binding type: `worker-configuration.d.ts` must include `DB: D1Database`.

### 3. Contracts

- Base tables: `cities`, `event_types`, `event_scales`, `tags`, `events`, `event_tags`.
- Seed counts:
    - `event_types` = 8
    - `event_scales` = 4
    - `cities` >= 50, current seed = 72
    - `tags` = 0
- Event status values are enforced by SQL CHECK: `pending`, `published`, `rejected`, `offline`.
- `events.type`, `events.scale`, and `events.city_id` are foreign keys into their dimension tables.
- `events.start_date` and `events.end_date` must parse as dates, and `end_date >= start_date`.
- D1 generated globals are the source of truth for local aliases in `src/types/cloudflare.ts`; do not hand-write full D1 interfaces.

### 4. Validation & Error Matrix

- Missing `d1_databases` binding or stale generated types -> `worker-configuration.d.ts` lacks `DB`; rerun `corepack pnpm generate-types` after config changes.
- Missing `env.DB` at runtime -> `getDB` throws a setup error naming `wrangler.jsonc d1_databases`.
- Foreign key writes fail unexpectedly -> confirm callers use `await getDB(...)` or call `ensureFK(db)` before direct D1 writes.
- Invalid status/date/type/scale/city writes -> rejected by SQL CHECK/FK constraints.

### 5. Good/Base/Bad Cases

- Good: apply local and remote migrations, then verify counts: `event_types=8`, `event_scales=4`, `cities=72`, `tags=0`.
- Base: downstream routes call `const db = await getDB(getRuntimeEnv())` before queries.
- Bad: adding a second DB binding name for the same database. Keep `DB` as the single app binding.
- Bad: adding seed tags. Tags are user/admin-created and start empty.

### 6. Tests Required

- Config/types/build:
    - `corepack pnpm generate-types`
    - `corepack pnpm exec tsc --noEmit`
    - `corepack pnpm lint`
    - `corepack pnpm build`
- D1 migration checks:
    - `corepack pnpm exec wrangler d1 migrations apply eventlist-db --local`
    - `corepack pnpm exec wrangler d1 migrations apply eventlist-db --remote` for first remote setup.
    - `corepack pnpm exec wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) AS count FROM cities"` -> `>= 50`.
    - Same count checks for remote after first setup.

### 7. Wrong vs Correct

#### Wrong

```ts
const db = getDB(getRuntimeEnv());
```

#### Correct

```ts
const db = await getDB(getRuntimeEnv());
```

## Scenario: Admin Review D1 Contracts

### 1. Scope / Trigger

- Trigger: admin-review adds D1-backed `/admin` pages, `/api/admin/*` mutations, and `migrations/0003_audit.sql`.
- D1 is the source of truth. Do not introduce KV mirrors for public or admin event truth.
- `foundation-db` owns the base schema; downstream tasks may extend `src/lib/db/queries.ts` but must preserve the shared constants in `src/lib/db/index.ts`.

### 2. Signatures

- Binding: `env.DB` via Wrangler `d1_databases` binding name `DB`.
- Access helper: `getDB(runtimeEnv): D1Database`; throws a clear setup error if `DB` is missing.
- Status helper: `updateEventStatus(db, id, fromStatus, toStatus, extra)` returns `"changed" | "already-target" | "conflict"`.
- Edit helper: `editEvent(db, id, input)` first verifies the event exists, then batches the `events` update, `event_tags` reset, and replacement inserts with `db.batch()`.
- Audit helper: `insertAudit(db, action, targetId, meta)` writes `audit_logs(action, target_id, meta, at)`.
- Tag merge helper: `mergeTags(db, from, to)` returns `"changed" | "already-target" | "conflict"` and updates `event_tags` plus `tags.alias_of_id` using `db.batch()`.

### 3. Contracts

- Status values: `pending`, `published`, `rejected`, `offline`.
- Admin status transitions:
    - `pending -> published` for approve, sets `published_at`.
    - `pending -> rejected` for reject, requires `reject_reason`.
    - `published -> offline` for offline.
    - `offline -> published` for republish.
- Audit actions: `approve`, `reject`, `edit`, `offline`, `republish`, `merge`.
- Tag merge:
    - `from` and `to` must be different positive IDs.
    - `from` must be canonical or already aliased to `to`.
    - `to` must be canonical: `tags.alias_of_id IS NULL`.
    - Delete duplicate `(event_id, tag_id)` rows before updating `from -> to`.
- Event edits:
    - Validate `type`, `scale`, `city_id`, dates, and required strings at the route/form layer.
    - Create missing canonical tags before the replacement batch, then batch event update + delete old joins + insert new joins.

### 4. Validation & Error Matrix

- Missing `env.DB` -> throw `"D1 binding DB is not configured..."` so setup errors are obvious.
- Status update changes one row -> API returns `{ ok: true }` and writes audit.
- Status update finds the target status already applied -> API returns `{ ok: true }` and does not write duplicate audit.
- Status update finds another state or missing event -> API returns 409 from the route layer.
- Tag merge `from === to` -> error.
- Tag merge source or target is missing/aliased unexpectedly -> conflict.
- Tag merge source is already aliased to target -> success, no duplicate audit row.

### 5. Good/Base/Bad Cases

- Good: approve pending event, write one `audit_logs` row, then a browser retry returns success without a second audit row.
- Base: list pages join `events` to `cities`, `event_types`, `event_scales`, and canonical `tags` for display.
- Base: editing an event replaces all `event_tags` in the same D1 batch as the event row update.
- Bad: using separate `BEGIN; ... COMMIT;` strings for D1 multi-step writes from application code. Use `db.batch([...])` for grouped statements.

### 6. Tests Required

- Type/build checks: `corepack pnpm generate-types`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm lint`, `corepack pnpm build`.
- Integration/manual checks once `foundation-db` exists:
    - pending -> approve -> published, one audit row.
    - approve retry -> success, no duplicate audit row.
    - published -> offline -> republish.
    - merge tag B into A, duplicate event tag rows removed.
    - merge retry after B is already aliased to A returns success without a second audit row.
    - edit event replaces removed tags and added tags together.

### 7. Wrong vs Correct

#### Wrong

```ts
await db.exec("BEGIN; UPDATE event_tags ...; UPDATE tags ...; COMMIT;");
```

#### Correct

```ts
await db.batch([
    db
        .prepare(
            "DELETE FROM event_tags WHERE tag_id = ? AND event_id IN (...)",
        )
        .bind(from, to),
    db
        .prepare("UPDATE event_tags SET tag_id = ? WHERE tag_id = ?")
        .bind(to, from),
    db.prepare("UPDATE tags SET alias_of_id = ? WHERE id = ?").bind(to, from),
]);
```
