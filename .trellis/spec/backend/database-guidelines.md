# Database Guidelines

> Executable D1 contracts for the event directory.

---

## Scenario: Single-File D1 Baseline

### 1. Scope / Trigger

- Trigger: any change to the development-stage D1 schema, constraints, indexes, or static event option catalogue.
- The site is still in development and intentionally keeps one deterministic baseline at `migrations/0001_init.sql`. A remote database that recorded an older copy of `0001` is incompatible and must be explicitly rebuilt under separate user authorization; application work must never delete or rebuild it automatically.
- D1 database: `eventlist-db`, binding `DB`, database id `b11ea70c-4597-4049-a650-718cfbc5b04f`.

### 2. Signatures

- Wrangler config:
    - `wrangler.jsonc.d1_databases[0].binding = "DB"`
    - `database_name = "eventlist-db"`
    - `migrations_dir = "migrations"`
- Baseline file: `migrations/0001_init.sql` creates all application tables, constraints, and indexes without mutable type/scale dimension tables.
- Shared option module: `src/lib/events/options.ts` exports type, scale, schedule-status, and admission-method catalogues together with their types, membership guards, and label helpers.
- Shared input-contract module: `src/lib/events/input.ts` owns `EventBaseInput`, `SubmissionInput`, and `AdminEventInput`. Form validators and D1 adapters import these domain types directly; `src/lib/db/submissions.ts` and `src/lib/db/admin-events.ts` only re-export them for compatibility and must not become their source of truth again.
- Access helper: `getDB(runtimeEnv): D1Database`; it returns the configured binding synchronously and never probes D1.
- Generated binding: `worker-configuration.d.ts` contains `DB: D1Database`.
- Application tables: `tags`, `events`, `event_visitors`, `event_tags`, `audit_logs`.

### 3. Contracts

- All application tables are SQLite `STRICT` tables.
- There is no `cities` table. Administrative location truth is `events.division_code`, validated and displayed through `src/lib/divisions.ts`.
- Seed counts on an empty database:
    - `tags = 0`
    - `events = 0`
    - `event_visitors = 0`
- Event types are the ordered `comic`, `doujin`, `concert`, `only`, `meeting`, `stage`, `dance`, `ipflash`, `exhibition`, `online`, and `other` entries in `EVENT_TYPES`.
- Event scales are the ordered `mini`, `small`, `mid`, `large`, and `mega` entries in `EVENT_SCALES`.
- Array order and labels in `src/lib/events/options.ts` are the UI catalogue; pages and components must not query D1 for these options.
- `tags.name` is trimmed, 1-24 characters, `COLLATE NOCASE UNIQUE`; aliases cannot reference themselves.
- `events.type` and `events.scale` use SQL `CHECK (... IN (...))` constraints containing the same codes as the shared TypeScript catalogue.
- `SubmissionInput` / `AdminEventInput` use `EventType` and `EventScale`; public and admin form parsers validate raw strings with the shared membership guards.
- `start_date` / `end_date` are canonical `YYYY-MM-DD`; `end_date >= start_date`.
- `start_time` / `end_time` are nullable local `HH:MM` values. When both exist on the same date, `end_time >= start_time`.
- `tag_suggestions` is nullable free text with a maximum length of 240. It is not a canonical tag relationship.
- `organizer` is nullable trimmed text with a maximum length of 200; `price_range` is nullable trimmed text with a maximum length of 120.
- `schedule_status` is nullable `postponed | cancelled`; `admission_method` is nullable `ticket | reservation | walk_in | invitation | other`. The shared option catalogue owns their Chinese labels.
- `admission_start_date` is a nullable canonical `YYYY-MM-DD`. `admission_start_time` is a nullable canonical `HH:MM` and is valid only when the date exists.
- Status is one of `pending`, `published`, `rejected`, `offline`.
- `audit_logs.meta` must be valid JSON.
- Query indexes cover public status/date listing, status/division listing, admin status/created order, sitemap status/updated order, tag-to-event lookup, and audit time/action lookup.

### 4. Validation & Error Matrix

- Missing `env.DB` -> `getDB` throws a setup error naming the D1 binding.
- Unknown type, scale, schedule status, or admission method submitted through public/admin forms -> explicit validation error; API routes return HTTP 400 JSON.
- Unknown option code written directly to D1 -> SQL CHECK failure.
- Organizer over 200 characters, price range over 120 characters, invalid admission date/time, or admission time without its date -> validation error and SQL CHECK failure.
- Invalid division code, date, time, date order, same-day time order, status, or overlong `tag_suggestions` -> SQL CHECK failure.
- Duplicate tags that differ only by ASCII case -> UNIQUE failure.
- Invalid audit JSON -> SQL CHECK failure.
- Multiple migration files before first deployment -> baseline drift; consolidate back into `0001_init.sql` and test from an empty persistence directory.

### 5. Good/Base/Bad Cases

- Good: apply the baseline to an empty `--persist-to` directory, observe one `d1_migrations` row, five application tables, and no `event_types`, `event_scales`, or `cities` table.
- Base: `docs/dev/seed-public-site.sql` applies after the baseline and inserts 143 valid events, 10 canonical tags, and 90 anonymous event visitor rows without schema changes; its primary detail sample includes the optional organizer/admission fields.
- Bad: querying D1 for type/scale options or joining dimension tables; these values are application-owned constants.
- Bad: defining a second TypeScript list of type/scale codes instead of importing `src/lib/events/options.ts`.
- Bad: validating a rewritten baseline against an old `.wrangler/state` database; previous migration records can hide missing statements.
- Bad: creating a `cities` mirror of `cn-division`; it creates two location sources of truth.
- Bad: adding `0002_*` before first deployment instead of updating the baseline.
- Bad: deploying code that reads the new columns against a remote D1 that recorded the older `0001`; rebuild that development database first after explicit authorization.

### 6. Tests Required

- Fresh migration:
    - `tmp=$(mktemp -d)`
    - `corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp"`
    - Assert only `0001_init.sql` is recorded.
- Schema assertions:
    - tables and indexes from `sqlite_schema`
    - `PRAGMA table_info(events)` includes `tag_suggestions`, times, organizer, schedule status, admission method, price range, and admission start date/time
    - `PRAGMA foreign_key_list(events)` is empty
    - `PRAGMA foreign_key_list(event_tags)` still references `events` and `tags` with cascade deletes
    - no `event_types`, `event_scales`, or `cities` table
- Option assertions: all 55 type/scale combinations insert successfully; an unknown type and an unknown scale each fail their SQL CHECK.
- Other constraint negatives: invalid status/date/time, reversed same-day time, overlong tag suggestions/organizer/price range, invalid schedule/admission codes, admission time without a date, duplicate case-insensitive tags, invalid audit JSON.
- Compatibility: apply `docs/dev/seed-public-site.sql`, then assert 143 events, 10 canonical tags, and 90 anonymous event visitor rows.
- Project gates: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`.

### 7. Wrong vs Correct

#### Wrong: D1-backed immutable options

```ts
const [types, scales] = await Promise.all([listTypes(db), listScales(db)]);
```

#### Correct: shared application catalogue

```ts
import { EVENT_SCALES, EVENT_TYPES } from "../lib/events/options";
```

#### Wrong: additional pre-production migrations

```text
migrations/0001_init.sql
migrations/0002_seed.sql
migrations/0003_audit.sql
migrations/0004_event_metadata.sql
```

#### Correct: one deterministic baseline

```text
migrations/0001_init.sql
```

---

## Scenario: Admin Review And Canonical Tags

### 1. Scope / Trigger

- Trigger: authenticated `/admin` event edits, status transitions, audit writes, and tag merging.
- D1 is the only event/tag source of truth; do not introduce KV mirrors.

### 2. Signatures

- `transitionEventStatus(db, id, fromStatus, toStatus, extra) -> Promise<StatusTransitionResult>` returns an outcome, an optional conflict reason, and mutation impact.
- `editEvent(db, id, input: AdminEventInput) -> Promise<EditEventResult>` returns `changed`, `conflict`, or `not-found` plus mutation impact.
- `createPublishedEvent(db, input: AdminEventInput, auditMeta)` creates a published event, canonical tags, relationships, and a `create` audit row in one D1 batch.
- `mergeTags(db, from, to) -> Promise<TagMergeResult>` returns `changed`, `already-target`, or `conflict` plus mutation impact.
- `AdminEventMutationValidationError` marks domain validation failures that mutation routes map to HTTP 400; unexpected binding/D1 failures remain HTTP 500.
- `AdminEventInput` includes typed type/scale/schedule/admission codes, the six nullable organizer/admission fields, nullable event times, and `tags: string[]`.
- `AdminCreateAuditMeta` includes `authMode: "access" | "token"` and an optional authenticated email.

### 3. Contracts

- Allowed transitions: pending->published, pending->rejected, published->offline, offline->published.
- Approve and republish require at least one canonical tag (`alias_of_id IS NULL`).
- Published/offline edits cannot replace tags with an empty set. Pending events may be saved without tags while moderation is incomplete.
- Admin tag input may reuse an existing canonical tag or create a new one; aliases resolve to the canonical target.
- Admin-created events require at least one normalized tag input, resolve aliases and new names to canonical relationships, write `status = published` plus `published_at`, and never enter the pending queue.
- The create batch uses one explicit `MAX(events.id) + 1` candidate for the event, relationships, and audit row. A concurrent ID conflict rolls back and retries the whole batch up to three times.
- `audit_logs.action` includes `create`; its metadata records `source = admin-create`, normalized tag names, auth mode, and authenticated email when available.
- Tag merge removes duplicate event relationships before replacing source IDs and marking the source as an alias.
- Status transitions, edits, and tag merges keep facts, relationship changes, conditional audit insertion, and their post-write probe in one `db.batch()` rollback boundary.
- Conditional audit statements use `WHERE changes() > 0`, so idempotent retries do not create duplicate audit rows.
- Multi-statement application writes use `db.batch()`, not SQL transaction strings.

### 4. Validation & Error Matrix

- Zero canonical tags on approve/republish -> HTTP 409 with a user-facing Chinese message; no state/audit change.
- Published/offline edit with zero tags -> HTTP 400 from the edit route; unexpected binding/D1 failures -> HTTP 500.
- Wrong source status or missing event -> HTTP 409.
- Already-target transition -> HTTP 200 without duplicate audit.
- Same-day end time earlier than start -> HTTP 400.
- Merge source equals target -> HTTP 400; non-canonical source/target state -> HTTP 409; unexpected binding/D1 failures -> HTTP 500.
- Admin create with zero tags, more than 12 tags, or a tag over 24 characters -> HTTP 400 before D1 writes.
- Concurrent candidate-ID collision -> full batch rollback and retry; other D1 failures -> HTTP 500 with no event/tag/audit partial state.

### 5. Good/Base/Bad Cases

- Good: save canonical tags on a pending event, approve it, and write one audit row.
- Good: create an admin event with an existing tag, an alias, and a new tag; publish immediately, attach canonical IDs, and write one `create` audit row.
- Base: pending event keeps `tag_suggestions` for moderator reference while `event_tags` remains empty.
- Bad: enabling the approve button based only on UI state; the API must independently query canonical tags.
- Bad: deleting/adding event tags outside the same D1 batch as the event edit.
- Bad: inserting an admin event first and attaching tags or audit rows in later calls; a failure would expose a partially created published event.

### 6. Tests Required

- Pending without tags -> approve 409; no audit row.
- Add a canonical tag -> approve 200; status published; one audit row.
- Published/offline edit to zero tags -> rejected.
- Offline without canonical tags -> republish 409.
- Tag merge removes duplicate relationships and is idempotent on retry.
- Optional time cases: none, start-only, end-only, same-day pair, cross-day pair, reversed same-day pair.
- Admin create: existing/new/alias/case-duplicate tags, published timestamp, audit metadata, invalid-data rollback, and two concurrent candidate-ID allocations.

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

For direct admin creation, use `createPublishedEvent()` instead of composing
`insertSubmission()`, `editEvent()`, and `insertAudit()` as separate calls.

---

## Scenario: Public Submission And Discovery

### 1. Scope / Trigger

- Trigger: public lists/details, visitor submission, tag discovery/filtering, and event JSON-LD.
- Public truth is D1; pending/rejected events never leak through public detail helpers.

### 2. Signatures

- `listPublishedEvents(db, filters)` -> `{ events, page, pageSize, hasNext }`.
- `getPublicEvent(db, id)` -> published/offline event or `null`.
- `insertSubmission(db, input: SubmissionInput)` -> new pending event ID.
- `SubmissionInput` has typed type/scale/schedule/admission codes, the six nullable organizer/admission fields, `tag_suggestions: string | null`, and no canonical `tags` array.
- `getPublicEventRecentVisitorCount(db, id)` returns the inclusive current China-local 30-day anonymous visitor count for published/offline events, or `0`.
- `searchTags(db, query, limit)` performs suggestion search; the public `tag` event filter performs exact canonical-name matching.
- `buildEventJsonLd(event, canonicalUrl)` combines known times with local `+08:00` ISO values.

### 3. Contracts

- Public lists require `status = published`. Catalogue timing uses `status=ended|all`; a missing or unknown value means `upcoming`.
- Timing is evaluated in China local time with SQLite `date/time('now', '+8 hours')`. An event is ended when its end date is before the local date, or when the date is today and a non-null `end_time` has passed. A date-only event remains upcoming through its entire end date.
- Location filtering uses `divisionCode`; 6/12-digit values match exactly, shorter province/city prefixes use `LIKE '<prefix>%'`.
- Supported URL fields are `status`, `city`, `type`, `scale`, `tag`, `from`, `to`, `starts`, `active`, `page`, and `sort`.
- Public type/scale option lists and display labels come from `src/lib/events/options.ts`; D1 stores only stable codes.
- Submission free-text suggestions are stored only in `events.tag_suggestions`; submission must not create rows in `tags` or `event_tags`.
- Canonical tags displayed on cards/details come only from canonical `event_tags` relationships.
- `tag` filtering is exact; `searchTags` may use substring search for suggestions.
- 公开分类聚合只统计 `events.status = published`，包含已结束活动；类型和规模从 `src/lib/events/options.ts` 的稳定目录投影，标签只连接 `alias_of_id IS NULL` 的规范标签，其他事件状态和标签别名不得进入分类计数。
- User date filters remain date-based. Timing classification uses `end_time` only when it exists; ended results default to end-date descending, while the default upcoming list remains start-date ascending.

### 4. Validation & Error Matrix

- Invalid division/type/scale/date/time/URL -> HTTP 400 JSON.
- Same-day reversed times -> HTTP 400 JSON.
- Tag suggestions over 240 characters -> HTTP 400 JSON.
- Missing/failed Turnstile -> existing 400/500/502 behavior from the public API error contract.
- Pending/rejected public detail -> 404; offline detail -> 200 with offline notice.
- Detail heat is queried separately from `PublicEventDetail`, never serializes `visitor_key`, and remains outside the static detail cache payload.
- Unknown exact tag -> empty list, not a substring match.

### 5. Good/Base/Bad Cases

- Good: submit `"东方、同人展、大型舞台"` as suggestion text; tag inventory count does not change.
- Good: `?tag=同人` does not match an event tagged only `同人展`.
- Base: historical event with null times renders dates only.
- Base: an event ending today without `end_time` stays in the upcoming list until the local day changes.
- Good: an event ending today at `18:00` moves to ended at or after `18:00` China local time.
- Bad: calling `findOrCreateTagIds()` from `insertSubmission()`.
- Bad: using `%${tag}%` in the public event filter.

### 6. Tests Required

- Seeded public list/detail/offline/pending behavior.
- Exact-vs-extended tag pair returns only the exact event for each query.
- Submission code path contains no canonical tag creation/attachment.
- Date/time formatter cases and JSON-LD date-only vs `+08:00` datetime output.
- Timing fixtures on both sides of the China-local day boundary, including today with null, future, and passed `end_time` values.
- Responsive public routes and `/admin/login`; light/dark token checks.
- Lint, TypeScript, and production build.

### 7. Wrong vs Correct

#### Wrong

```sql
date(events.end_date) < date('now')
```

This uses UTC and cannot classify an event that already ended earlier today.

#### Correct

```sql
events.end_date < date('now', '+8 hours')
OR (
    events.end_date = date('now', '+8 hours')
    AND events.end_time IS NOT NULL
    AND events.end_time <= time('now', '+8 hours')
)
```

The schema and form/query parsers enforce canonical `YYYY-MM-DD` / `HH:MM`
values, so direct column comparisons preserve semantics and allow D1 to use the
date/order indexes. Never remove canonical validation when removing SQL column
wrappers.

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

---

## Scenario: Homepage Discovery And Dual-Intent Anonymous Popularity

### 1. Scope / Trigger

- Trigger: homepage featured discovery, unopened/unended intent ranking, event detail view deduplication, or 3/7/30-day popularity changes.
- D1 remains the only event and popularity source of truth. Do not add a KV mirror, Analytics Engine projection, or third-party recommendation store.

### 2. Signatures

- `listHomepageDiscovery(db, divisionCode, asOfDate?) -> Promise<HomepageDiscovery>` returns only `featuredEvents`, with at most five ranked local candidates. A supplied `asOfDate` must be canonical `YYYY-MM-DD` and binds the query to the cache key date.
- `listHomepagePopularity(db, divisionCode, window: 3 | 7 | 30) -> Promise<HomepagePopularity>` returns `{ window, unopened, unended }`; each scene contains independent `local` and `nationwide` lists from one four-statement `db.batch()` call.
- `recordEventView(db, eventId, visitorKey) -> Promise<"changed" | "already-current" | "ignored">` inserts or refreshes one event-scoped visitor row and probes the final state in one D1 batch.
- `deleteExpiredEventVisitors(db) -> Promise<number>` deletes rows older than the retained 30-day window and returns the number removed; the Worker scheduled handler owns this cleanup.
- `hashEventVisitor(eventId, ip, secret) -> Promise<string>` returns a 64-character lowercase HMAC-SHA-256 key.
- `PublishedEventFilters.starts` and `.active` are optional canonical `YYYY-MM-DD` strings.
- `event_visitors(event_id, visitor_key, last_seen_date)` has primary key `(event_id, visitor_key)` and `ON DELETE CASCADE` to `events`.

### 3. Contracts

- `event_visitors` is `STRICT`; `visitor_key` is exactly 64 lowercase hexadecimal characters and `last_seen_date` is a canonical China-local date.
- The raw `CF-Connecting-IP` value is hashed at the API boundary and must never reach D1, logs, responses, page props, or popularity result types.
- The HMAC input includes `eventId`, so one address cannot be correlated across different events from stored keys.
- `recordEventView` performs no cleanup on the request path. It records only a published, not-ended event and distinguishes a new/refresh write, an already-current row, and an ignored event state.
- The custom Worker entrypoint delegates normal fetches to Astro and runs `deleteExpiredEventVisitors()` from the daily `5 16 * * *` Cron trigger (00:05 China time).
- Repeated views update only `last_seen_date`; the primary key guarantees one contribution per event visitor in every selected window.
- Featured candidates use `NOT EVENT_ENDED_CLAUSE`, match the selected division, and have `start_date <= China-local today + 14 days`; there is no start-date lower bound, so an earlier-started activity remains eligible while it has not ended.
- Featured ranking is deterministic: already-started events first, then scale descending, start date ascending, cover presence descending, and event ID ascending. “Already started” means a date before today, or today with no `start_time` / a `start_time` that has arrived in China local time.
- `HomepageDiscovery.featuredEvents` applies `LIMIT 5` and returns the successful result array without collapsing it to one record.
- Popularity counts visitor rows whose `last_seen_date` is within the selected inclusive China-local window. Qualified activities `LEFT JOIN recent_visitors`; `COALESCE(unique_visitors, 0)` keeps zero-heat fallback candidates instead of dropping them.
- `unopened` contains only published, not-ended activities with a non-null `admission_start_date` from today through `today + 14 days`, inclusive. A future date qualifies; today qualifies only when `admission_start_time` is null or later than the current China-local time.
- `unended` contains every published activity that does not satisfy `EVENT_ENDED_CLAUSE`, including already-started activities and date-only activities through their entire end date.
- Each scene runs one local and one nationwide statement with its own `LIMIT 5`. Local uses the existing division prefix/exact matching contract. Nationwide has no location exclusion, so the same activity may appear in both scopes.
- Every list orders heat descending first. `unopened` then orders earlier admission date/time, scale, and ID; `unended` then orders already-started activities first, earlier start date/time, scale, and ID.
- The homepage catalogue CTA carries only `city`. Catalogue support for `starts=date` and `active=date` remains unchanged, but the homepage does not preselect either filter.

### 4. Validation & Error Matrix

- Missing or empty homepage division code -> reject before running popularity statements.
- Invalid explicit homepage `asOfDate` -> throw `RangeError` before preparing the discovery query.
- Any failed result in the four-statement popularity batch -> throw a query-specific error; never return a mixed or partial scene snapshot.
- Invalid popularity URL value -> parse to the default 7-day window.
- Invalid `starts` / `active` URL value -> ignore it through the shared date parser.
- Invalid visitor key length or characters -> SQL CHECK failure.
- Missing, unpublished, offline, or ended event during `recordEventView` -> `ignored`; the beacon route still returns the same successful 204 and does not reveal public-event state.

### 5. Good/Base/Bad Cases

- Good: two requests for one event and one address store one row; the same address visiting another event stores an unrelated key.
- Good: a date-only event remains eligible through its end date and never receives an invented time-based order.
- Base: an empty `event_visitors` table still returns up to five qualified zero-heat candidates in each local/nationwide scene list.
- Good: an activity that started yesterday and is still active can appear in both `featuredEvents` and the `unended` ranking.
- Good: an activity opening today with no admission time stays in `unopened` for the whole China-local day; one with a known admission time leaves at that time.
- Bad: using an inner join to `recent_visitors`; it removes qualified zero-heat activities and leaves short lists even when fallback candidates exist.
- Bad: `COUNT(*)` over raw request logs or a cross-event IP hash; both violate the event-scoped privacy boundary.
- Bad: removing local IDs from the nationwide ranking; nationwide means all regions, not non-local regions.

### 6. Tests Required

- Apply `0001_init.sql` to a fresh `--persist-to` directory; assert the visitor table, recent-date index, strict key/date constraints, foreign key, and one migration record.
- Apply `docs/dev/seed-public-site.sql`; assert 120 same-date events, six ongoing events, 90 visitor rows, 64-character keys, and aggregate 3/7/30-day counts of 15/35/90.
- Assert featured selection has no start-date lower bound, limits future starts to China-local today + 14 days, still excludes ended activities, ranks already-started candidates first, and uses `LIMIT 5`.
- Assert `HomepageDiscovery.featuredEvents` returns the complete candidate array in stable query order.
- Assert discovery prepares exactly one Hero statement and `HomepageDiscovery` has no `today` field.
- Execute popularity against SQLite fixtures and assert one four-statement batch, four independent `LIMIT 5` clauses, local prefix matching, nationwide inclusion of local events, and rejection of pending/ended activities.
- Cover the inclusive 14-day admission boundary, today with future/passed/null admission time, ongoing-first `unended` ties, zero-heat fallback, heat/scale/ID stability, and complete scene result mapping.
- Assert one event-scoped key for repeated views, separate keys for different IPs or events, 30-day purge behavior, and no raw-IP column or value.
- Assert the request path contains no visitor cleanup, the daily scheduled handler invokes cleanup, and popularity/cleanup query plans use `idx_event_visitors_recent`.
- Compare direct indexed date/order queries with the legacy `date(...)`/`time(...)` expressions on the seeded catalogue for listing order, pagination, and 3/7/30-day popularity.
- Assert `starts` and `active` catalogue URLs produce removable conditions and exact matching results.
- Run Prettier, TypeScript, Wrangler type sync, ESLint, and the production build. The current installed TypeScript 7 / `@typescript-eslint/parser` toolchain loads successfully, so lint failures are normal hard-gate failures rather than the historical parser exception.

### 7. Wrong vs Correct

#### Wrong

```ts
await db.prepare("INSERT INTO event_visitors(event_id, ip) VALUES (?, ?)").bind(eventId, ip).run();
```

#### Correct

```ts
const visitorKey = await hashEventVisitor(eventId, ip, env.VIEW_HASH_SECRET);
await recordEventView(db, eventId, visitorKey);
```

#### Wrong: zero-heat candidates disappear

```sql
FROM events
JOIN recent_visitors ON recent_visitors.event_id = events.id
```

#### Correct: qualified activities own the candidate set

```sql
FROM events
LEFT JOIN recent_visitors ON recent_visitors.event_id = events.id
ORDER BY COALESCE(recent_visitors.unique_visitors, 0) DESC
```
