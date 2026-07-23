# Technical Design

## Boundaries

The feature adds one authenticated admin workflow across four boundaries:

1. `AdminLayout` and the admin navigation expose `/admin/events/new`.
2. The Astro page renders the existing event fields and the canonical-tag
   editor with the current tag inventory.
3. `POST /api/admin/events` parses `FormData`, validates it with the existing
   admin parser, and calls one database write operation.
4. The D1 query layer creates a published event, resolves or creates canonical
   tags, attaches `event_tags`, and records an audit row.

The public `/submit` route remains unchanged. It continues to require
Turnstile, create `pending` events, and store only `tag_suggestions`.

## Data Flow And Contracts

```text
/admin/events/new
  -> FormData(name=event fields + tags joined by 、)
  -> POST /api/admin/events (authenticated by existing middleware)
  -> parseEventForm(FormData): AdminEventInput
  -> createPublishedEvent(D1, input, auditMeta)
  -> published events + canonical tags + event_tags + audit_logs
  -> { ok: true, data: { id } }
  -> /admin/events/:id/edit
```

`AdminEventInput.tags` is normalized to unique, trimmed values, with at most
12 tags and each tag between 1 and 24 characters. The parser also validates
canonical dates, optional times, type/scale membership, county division codes,
and HTTP(S) URLs. The API returns HTTP 400 for form errors and HTTP 500 for
unexpected D1 failures using the existing JSON envelope.

The new query operation writes `status = 'published'` and
`published_at = datetime('now')`. It accepts an audit metadata object that
identifies the source as an admin-created event and stores the selected tag
names.

## D1 Write Strategy

`D1Database.batch()` is the transaction boundary, matching the existing
database guideline. D1 batch statements cannot bind the result of an earlier
statement into later prepared statements, so the query layer first reads
`MAX(events.id) + 1` as a candidate ID. The batch then:

1. `INSERT OR IGNORE`s the normalized tag names.
2. Inserts the event with the candidate ID and published fields.
3. Inserts `event_tags` using a SQL select that maps aliases to their canonical
   target IDs and ignores duplicate relationships.
4. Inserts the `create` audit row with the same explicit event ID.

If another writer claims the candidate ID between the read and batch, the
batch fails without committing its statements; the helper retries with a new
candidate. This preserves sequential-looking IDs while keeping the event,
tag relationships, and audit row in one transaction. Existing edit and public
submission paths keep their current behavior.

The audit action check in `migrations/0001_init.sql` and `AuditAction` gains
`create`. This repository has a single pre-production baseline, so no second
migration is introduced.

## Frontend Reuse

The new page and existing edit page share an `AdminEventForm.astro` field
composition. The component receives an optional event record, the canonical
tag inventory, the form ID, submit label, and return URL. `TagInput.svelte`
continues to serialize `tags` as `、`-joined values, offers existing canonical
tags from `listTags`, and permits a new tag through the same control. The
page-specific scripts only own POST/PATCH method, busy state, errors, and
redirect behavior.

The navigation adds a `create` item and a plus icon to both desktop and mobile
admin shells. Active-state matching treats the new route as its own item and
does not mark the published queue active.

## Compatibility And Rollback

- No public route, public form field, or visitor submission contract changes.
- Existing event edit and moderation routes continue to use `editEvent` and
  status-transition helpers.
- If the feature must be reverted before deployment, remove the new route,
  query operation, and navigation item together; the baseline schema remains
  compatible because the new audit action is only additive.
- After the baseline has been deployed, the `create` audit check would require
  a normal forward migration; this task follows the repository's current
  single-baseline convention.

## Risks And Deferred Items

- The admin form keeps `submitter_contact` as an explicit required field to
  preserve the existing event contract; deriving it from Access/Token identity
  is deferred.
- The current `TagInput` interaction is reused rather than introducing a
  second combobox primitive. It already supports canonical suggestions and a
  new value, and its server-side parser remains authoritative.
- No automated test runner exists in `package.json`; validation uses fresh
  local D1 assertions plus lint, TypeScript, and production build gates.
