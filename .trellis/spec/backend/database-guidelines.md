# Database Guidelines

> Executable D1 contracts for the event directory.

---

## Scenario: Single-File D1 Baseline

### 1. Scope / Trigger

- Trigger: any change to the initial D1 schema, constraints, indexes, or dimension seeds before the first production deployment.
- The site has no deployed database migration history. Keep one deterministic baseline at `migrations/0001_init.sql` until the first deployment.
- D1 database: `eventlist-db`, binding `DB`, database id `b11ea70c-4597-4049-a650-718cfbc5b04f`.

### 2. Signatures

- Wrangler config:
    - `wrangler.jsonc.d1_databases[0].binding = "DB"`
    - `database_name = "eventlist-db"`
    - `migrations_dir = "migrations"`
- Baseline file: `migrations/0001_init.sql` creates tables, constraints, indexes, and the `event_types` / `event_scales` seeds.
- Access helper: `await getDB(runtimeEnv): Promise<D1Database>`.
- Generated binding: `worker-configuration.d.ts` contains `DB: D1Database`.
- Tables: `event_types`, `event_scales`, `tags`, `events`, `event_tags`, `audit_logs`.

### 3. Contracts

- All application tables are SQLite `STRICT` tables.
- There is no `cities` table. Administrative location truth is `events.division_code`, validated and displayed through `src/lib/divisions.ts`.
- Seed counts on an empty database:
    - `event_types = 8`
    - `event_scales = 4`
    - `tags = 0`
    - `events = 0`
- `tags.name` is trimmed, 1-24 characters, `COLLATE NOCASE UNIQUE`; aliases cannot reference themselves.
- `events.type` and `events.scale` are foreign keys into their dimension tables.
- `start_date` / `end_date` are canonical `YYYY-MM-DD`; `end_date >= start_date`.
- `start_time` / `end_time` are nullable local `HH:MM` values. When both exist on the same date, `end_time >= start_time`.
- `tag_suggestions` is nullable free text with a maximum length of 240. It is not a canonical tag relationship.
- Status is one of `pending`, `published`, `rejected`, `offline`.
- `audit_logs.meta` must be valid JSON.
- Query indexes cover public status/date listing, status/division listing, admin status/created order, sitemap status/updated order, tag-to-event lookup, and audit time/action lookup.

### 4. Validation & Error Matrix

- Missing `env.DB` -> `getDB` throws a setup error naming the D1 binding.
- Unknown type or scale -> foreign key failure.
- Invalid division code, date, time, date order, same-day time order, status, or overlong `tag_suggestions` -> SQL CHECK failure.
- Duplicate tags that differ only by ASCII case -> UNIQUE failure.
- Invalid audit JSON -> SQL CHECK failure.
- Multiple migration files before first deployment -> baseline drift; consolidate back into `0001_init.sql` and test from an empty persistence directory.

### 5. Good/Base/Bad Cases

- Good: apply the baseline to an empty `--persist-to` directory, observe one `d1_migrations` row, 8 types, 4 scales, and no `cities` table.
- Base: `docs/dev/seed-public-site.sql` applies after the baseline and inserts valid events/tags without schema changes.
- Bad: validating a rewritten baseline against an old `.wrangler/state` database; previous migration records can hide missing statements.
- Bad: creating a `cities` mirror of `cn-division`; it creates two location sources of truth.
- Bad: adding `0002_*` before first deployment instead of updating the baseline.

### 6. Tests Required

- Fresh migration:
    - `tmp=$(mktemp -d)`
    - `corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp"`
    - Assert only `0001_init.sql` is recorded.
- Schema assertions:
    - tables and indexes from `sqlite_schema`
    - `PRAGMA table_info(events)` includes `tag_suggestions`, `start_time`, `end_time`
    - `PRAGMA foreign_key_list(events)` references `event_types` and `event_scales`
    - no `cities` table
- Constraint negatives: invalid status/date/time, reversed same-day time, overlong tag suggestions, duplicate case-insensitive tags, invalid audit JSON.
- Compatibility: apply `docs/dev/seed-public-site.sql`, then assert 4 events and 4 tags.
- Project gates: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`.

### 7. Wrong vs Correct

#### Wrong

```text
migrations/0001_init.sql
migrations/0002_seed.sql
migrations/0003_audit.sql
migrations/0004_event_metadata.sql
```

before the first deployment.

#### Correct

```text
migrations/0001_init.sql
```

containing the complete fresh-install contract.

---

## Scenario: Admin Review And Canonical Tags

### 1. Scope / Trigger

- Trigger: authenticated `/admin` event edits, status transitions, audit writes, and tag merging.
- D1 is the only event/tag source of truth; do not introduce KV mirrors.

### 2. Signatures

- `updateEventStatus(db, id, fromStatus, toStatus, extra)` -> `"changed" | "already-target" | "conflict"`.
- `editEvent(db, id, input: AdminEventInput)` batches the event update and complete `event_tags` replacement.
- `hasCanonicalEventTag(db, eventId)` -> `boolean`.
- `insertAudit(db, action, targetId, meta)` writes JSON metadata.
- `mergeTags(db, from, to)` -> `"changed" | "already-target" | "conflict"`.
- `AdminEventInput` includes nullable `start_time`, nullable `end_time`, and `tags: string[]`.

### 3. Contracts

- Allowed transitions: pending->published, pending->rejected, published->offline, offline->published.
- Approve and republish require at least one canonical tag (`alias_of_id IS NULL`).
- Published/offline edits cannot replace tags with an empty set. Pending events may be saved without tags while moderation is incomplete.
- Admin tag input may reuse an existing canonical tag or create a new one; aliases resolve to the canonical target.
- Tag merge removes duplicate event relationships before replacing source IDs and marking the source as an alias.
- Multi-statement application writes use `db.batch()`, not SQL transaction strings.

### 4. Validation & Error Matrix

- Zero canonical tags on approve/republish -> HTTP 409 with a user-facing Chinese message; no state/audit change.
- Published/offline edit with zero tags -> HTTP 400 from the edit route.
- Wrong source status or missing event -> HTTP 409.
- Already-target transition -> HTTP 200 without duplicate audit.
- Same-day end time earlier than start -> HTTP 400.
- Merge source equals target or uses unexpected aliases -> error/conflict.

### 5. Good/Base/Bad Cases

- Good: save canonical tags on a pending event, approve it, and write one audit row.
- Base: pending event keeps `tag_suggestions` for moderator reference while `event_tags` remains empty.
- Bad: enabling the approve button based only on UI state; the API must independently query canonical tags.
- Bad: deleting/adding event tags outside the same D1 batch as the event edit.

### 6. Tests Required

- Pending without tags -> approve 409; no audit row.
- Add a canonical tag -> approve 200; status published; one audit row.
- Published/offline edit to zero tags -> rejected.
- Offline without canonical tags -> republish 409.
- Tag merge removes duplicate relationships and is idempotent on retry.
- Optional time cases: none, start-only, end-only, same-day pair, cross-day pair, reversed same-day pair.

### 7. Wrong vs Correct

#### Wrong

```ts
await updateEventStatus(db, id, STATUS.PENDING, STATUS.PUBLISHED);
```

without checking tags.

#### Correct

```ts
if (!(await hasCanonicalEventTag(db, id))) {
    return jsonError("请先整理至少一个规范标签，再发布活动", 409);
}
await updateEventStatus(db, id, STATUS.PENDING, STATUS.PUBLISHED);
```

---

## Scenario: Public Submission And Discovery

### 1. Scope / Trigger

- Trigger: public lists/details, visitor submission, tag discovery/filtering, and event JSON-LD.
- Public truth is D1; pending/rejected events never leak through public detail helpers.

### 2. Signatures

- `listPublishedEvents(db, filters)` -> `{ events, page, pageSize, hasNext }`.
- `getPublicEvent(db, id)` -> published/offline event or `null`.
- `insertSubmission(db, input: SubmissionInput)` -> new pending event ID.
- `SubmissionInput` has `tag_suggestions: string | null`, `start_time: string | null`, `end_time: string | null`; it has no canonical `tags` array.
- `searchTags(db, query, limit)` performs suggestion search; the public `tag` event filter performs exact canonical-name matching.
- `buildEventJsonLd(event, canonicalUrl)` combines known times with local `+08:00` ISO values.

### 3. Contracts

- Public lists require `status = published` and `end_date >= date('now')`.
- Location filtering uses `divisionCode`; 6/12-digit values match exactly, shorter province/city prefixes use `LIKE '<prefix>%'`.
- Supported URL fields remain `city`, `type`, `scale`, `tag`, `from`, `to`, `page`, `sort`.
- Submission free-text suggestions are stored only in `events.tag_suggestions`; submission must not create rows in `tags` or `event_tags`.
- Canonical tags displayed on cards/details come only from canonical `event_tags` relationships.
- `tag` filtering is exact; `searchTags` may use substring search for suggestions.
- Date filtering, expiry, and sort remain date-based even when times exist.

### 4. Validation & Error Matrix

- Invalid division/type/scale/date/time/URL -> HTTP 400 JSON.
- Same-day reversed times -> HTTP 400 JSON.
- Tag suggestions over 240 characters -> HTTP 400 JSON.
- Missing/failed Turnstile -> existing 400/500/502 behavior from the public API error contract.
- Pending/rejected public detail -> 404; offline detail -> 200 with offline notice.
- Unknown exact tag -> empty list, not a substring match.

### 5. Good/Base/Bad Cases

- Good: submit `"东方、同人展、大型舞台"` as suggestion text; tag inventory count does not change.
- Good: `?tag=同人` does not match an event tagged only `同人展`.
- Base: historical event with null times renders dates only.
- Bad: calling `findOrCreateTagIds()` from `insertSubmission()`.
- Bad: using `%${tag}%` in the public event filter.

### 6. Tests Required

- Seeded public list/detail/offline/pending behavior.
- Exact-vs-extended tag pair returns only the exact event for each query.
- Submission code path contains no canonical tag creation/attachment.
- Date/time formatter cases and JSON-LD date-only vs `+08:00` datetime output.
- Responsive public routes and `/admin/login`; light/dark token checks.
- Lint, TypeScript, and production build.

### 7. Wrong vs Correct

#### Wrong

```ts
const tagIds = await findOrCreateTagIds(db, input.tags);
```

inside visitor submission.

#### Correct

```ts
await db
    .prepare("INSERT INTO events(..., tag_suggestions, status) VALUES (..., ?, ?)")
    .bind(...values, input.tag_suggestions, STATUS.PENDING)
    .run();
```
