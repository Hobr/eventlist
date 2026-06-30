# Database Guidelines

> Database patterns and conventions for this project.

---

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
