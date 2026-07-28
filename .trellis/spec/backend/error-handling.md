# Error Handling

> How errors are handled in this project.

---

## Scenario: Admin API Responses

### 1. Scope / Trigger

- Trigger: admin-review adds authenticated `/api/admin/*` mutation routes.
- All admin API routes must return a stable JSON envelope so Astro pages can handle errors consistently.

### 2. Signatures

- Success: `jsonOk(data?) -> Response` with `{ ok: true, data? }`.
- Failure: `jsonError(error, status?, details?) -> Response` with `{ ok: false, error, details? }`.
- Routes live under `src/pages/api/admin/**` and use Astro `APIRoute`.
- `POST /api/admin/events` accepts administrator `FormData` and returns `201 { ok: true, data: { id } }` after an immediate published insert.

### 3. Contracts

- Unauthorized admin API request -> HTTP 401, `{ ok: false, error: "Unauthorized" }`.
- Validation failure -> HTTP 400, JSON error.
- State conflict -> HTTP 409, JSON error.
- Unexpected D1/setup failure -> HTTP 500, JSON error.
- Authenticated pages can redirect; APIs must not redirect.
- 需要返回逐记录错误、警告或最新预览时，稳定结构放在可选的 `details` 中；现有只读取 `error` 的调用方必须保持兼容。

### 4. Validation & Error Matrix

- Invalid event id -> 400.
- Missing reject reason -> 400.
- Missing `env.DB` -> 500 from route catch, message should name the DB binding setup problem.
- Already-target status mutation -> 200 `{ ok: true }` and no new audit row.
- Wrong source status -> 409.
- Already-merged tag mutation -> 200 `{ ok: true }` and no new audit row.
- Missing or non-canonical tag merge endpoint -> 409.
- Approve/republish without a canonical event tag -> 409 with an instruction to organize tags first.
- Admin create validation failure, including zero canonical tags -> 400 with a user-facing Chinese message.
- Unexpected admin create D1/binding failure -> 500; the D1 batch leaves no partial event, tag relationship, or audit row.

### 5. Good/Base/Bad Cases

- Good: frontend `fetch()` checks `response.ok`, then reads `body.error` only on failure.
- Good: the create page reads `body.data.id` on a 201 response and redirects to `/admin/events/:id/edit`.
- Base: form endpoints accept `FormData` because admin pages submit forms.
- Bad: returning HTML redirects from `/api/admin/*`; browser fetch callers will not surface useful errors.
- Bad: returning 201 before tag relationships and the `create` audit row are committed.

### 6. Tests Required

- Lint/type/build: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`.
- Route checks once D1 exists:
    - unauthenticated `/api/admin/...` returns 401 JSON.
    - invalid id returns 400 JSON.
    - wrong transition returns 409 JSON.
    - duplicate target transition returns 200 JSON without duplicate audit.
    - duplicate tag merge returns 200 JSON without duplicate audit.
    - valid admin create returns 201, a published event ID, canonical tags, and one audit row.
    - invalid/no-tag admin create returns 400 and writes no event.

### 7. Wrong vs Correct

#### Wrong

```ts
return context.redirect("/admin/login");
```

from an API route.

#### Correct

```ts
return jsonError("Unauthorized", 401);
```

## Scenario: Public API Responses

### 1. Scope / Trigger

- Trigger: `public-site` adds unauthenticated visitor APIs under `src/pages/api/*`, including `POST /api/submit`.
- These APIs are called by public Svelte/Astro forms and must use the same JSON envelope as admin APIs.

### 2. Signatures

- `GET /api/tags?q=<query>` -> `{ ok: true, data: { tags } }`.
- `GET /api/popularity?city=<region>&trend=<3|7|30>` -> `{ ok: true, data: { popularity } }` with one local and one nationwide public ranking.
- `POST /api/submit` accepts `FormData` and returns `201 { ok: true, data: { id } }` after a pending insert.
- Turnstile wrapper: `verifyTurnstile(token, secret, remoteIp?)` returns `{ success, errors }` or throws a setup/upstream error.

### 3. Contracts

- Public APIs never redirect. They return JSON via `jsonOk` / `jsonError`.
- The popularity API validates `city` with the shared region catalogue and accepts only the exact windows `3`, `7`, and `30`.
- Popularity responses use the shared homepage public projection and expose only `id`, `title`, `division_code`, `start_date`, and `unique_visitors` for each event. They must never serialize `submitter_contact`, `source_url`, `tag_suggestions`, moderation fields, or an expanded `EventRecord` / `PopularEvent`.
- `TURNSTILE_SECRET_KEY` is required for `POST /api/submit` but must not be committed to `wrangler.jsonc`; use `wrangler secret put` for deployed envs and `.dev.vars` for local dev.
- `TURNSTILE_SITE_KEY` may be public and is declared in `wrangler.jsonc` vars.
- Cloudflare Turnstile test secret belongs in `.dev.vars.example` only.

### 4. Validation & Error Matrix

- Missing required form field -> 400 JSON with a user-facing validation message.
- Invalid URL/date/time/type/scale/division code -> 400 JSON.
- Same-day end time earlier than start time -> 400 JSON.
- Tag suggestions longer than 240 characters -> 400 JSON.
- Missing `TURNSTILE_SECRET_KEY` -> 500 JSON.
- Turnstile siteverify network/TLS failure -> 502 JSON with `Turnstile verification request failed`.
- Turnstile verification returns `success: false` -> 400 JSON.
- Successful submission -> 201 JSON and a new `pending` event.
- Invalid or missing popularity `city` / `trend` -> 400 JSON.
- Popularity D1/setup failure -> 500 JSON with a stable Chinese message; do not return the internal exception string.

### 5. Good/Base/Bad Cases

- Good: browser `fetch()` posts same-origin `FormData` from `/submit` and handles `response.ok`.
- Good: local tests copy `.dev.vars.example` to `.dev.vars` rather than committing a real secret.
- Base: Astro dev may block curl form posts without an `Origin` header; include same-origin `Origin` when testing with curl.
- Good: the homepage initial popularity props and `/api/popularity` response are produced by the same explicit field projection.
- Bad: returning `{ ...event }` or a raw `PopularEvent[]` from the popularity API; inherited event fields include non-public submission data.
- Bad: letting workerd internal Turnstile/TLS references escape to users as 400 validation errors.
- Bad: adding a development bypass that accepts fake Turnstile tokens in application code.

### 6. Tests Required

- Missing source link/contact/Turnstile token returns JSON failure.
- With a valid local Turnstile secret and network trust chain, a test submission writes `pending`.
- If local workerd rejects the Turnstile TLS certificate chain, verify the route returns a clear 502 and document the environment limit.
- Popularity invalid region/window checks return 400 JSON; valid requests return both lists and no non-display event fields.
- Popularity D1 failure returns the stable 500 envelope without leaking binding or SQL details.
- `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, and production build must pass.

### 7. Wrong vs Correct

#### Wrong

```ts
return jsonError(error instanceof Error ? error.message : "Failed", 400);
```

for Turnstile upstream failures.

#### Correct

```ts
return jsonError("Turnstile verification request failed", 502);
```

---

## Scenario: Event View Beacon API

### 1. Scope / Trigger

- Trigger: `POST /api/events/:id/view` or the non-blocking script on a public event detail page changes.

### 2. Signatures

- `POST /api/events/<positive-safe-integer>/view` accepts an empty same-origin request body.
- Required runtime inputs: `CF-Connecting-IP`, `VIEW_HASH_SECRET`, and the `DB` binding.
- Success returns HTTP 204 with an empty body. Failures use `jsonError` unless Astro's own cross-site POST protection rejects the request first.

### 3. Contracts

- Only a published event detail page exposes `data-event-view-endpoint`; offline pages never emit the beacon target.
- The browser sends a same-origin `fetch()` with `method: "POST"`, `credentials: "same-origin"`, and `keepalive: true`.
- Beacon failure is swallowed in the browser and never delays or changes detail rendering.
- The route validates origin and configuration before hashing. It never logs, returns, or forwards the raw IP to database code.
- A valid request for a missing, unpublished, or ended event returns 204 without a write so the endpoint does not disclose event state.

### 4. Validation & Error Matrix

- Non-decimal, zero, negative, or unsafe event ID -> 400 JSON.
- Missing or mismatched `Origin` -> 403 JSON; Astro may return its own 403 before route code for a cross-site POST.
- Missing `CF-Connecting-IP` -> 503 JSON.
- Missing `VIEW_HASH_SECRET` -> 503 JSON.
- Hashing, binding, or D1 failure -> 500 JSON with `访问统计暂时不可用`.
- Accepted request, including a duplicate or no-op event state -> 204 empty response.

### 5. Good/Base/Bad Cases

- Good: two concurrent requests for the same event/IP both return 204 and create only one row.
- Good: a second IP creates a second row without exposing either key in the response.
- Base: local Workers development may synthesize `CF-Connecting-IP`; use direct route tests to exercise the truly missing-header branch.
- Bad: recording a view during SSR; crawlers and failed page renders would inflate the count and could block the detail page.
- Bad: returning the visitor key for debugging or including the source IP in an error message.

### 6. Tests Required

- Detail HTML for a published event contains the endpoint; offline detail HTML does not.
- Invalid ID returns 400, cross-origin returns 403, and missing secret returns 503.
- With controlled IP headers, repeated same-IP POSTs and one different-IP POST all return 204; D1 increases by exactly two rows.
- A missing or ended event returns 204 and does not change D1.
- Search source, schema, seed, responses, and logs for raw IP persistence; only the API boundary and Turnstile forwarding may read the header.

### 7. Wrong vs Correct

#### Wrong

```ts
await recordEventView(db, eventId, request.headers.get("CF-Connecting-IP") ?? "");
```

#### Correct

```ts
const visitorKey = await hashEventVisitor(eventId, ip, runtimeEnv.VIEW_HASH_SECRET);
await recordEventView(db, eventId, visitorKey);
```
