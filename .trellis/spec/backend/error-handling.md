# Error Handling

> How errors are handled in this project.

---

## Scenario: Admin API Responses

### 1. Scope / Trigger

- Trigger: admin-review adds authenticated `/api/admin/*` mutation routes.
- All admin API routes must return a stable JSON envelope so Astro pages can handle errors consistently.

### 2. Signatures

- Success: `jsonOk(data?) -> Response` with `{ ok: true, data? }`.
- Failure: `jsonError(error, status?) -> Response` with `{ ok: false, error }`.
- Routes live under `src/pages/api/admin/**` and use Astro `APIRoute`.
- `POST /api/admin/events` accepts administrator `FormData` and returns `201 { ok: true, data: { id } }` after an immediate published insert.

### 3. Contracts

- Unauthorized admin API request -> HTTP 401, `{ ok: false, error: "Unauthorized" }`.
- Validation failure -> HTTP 400, JSON error.
- State conflict -> HTTP 409, JSON error.
- Unexpected D1/setup failure -> HTTP 500, JSON error.
- Authenticated pages can redirect; APIs must not redirect.

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
- `POST /api/submit` accepts `FormData` and returns `201 { ok: true, data: { id } }` after a pending insert.
- Turnstile wrapper: `verifyTurnstile(token, secret, remoteIp?)` returns `{ success, errors }` or throws a setup/upstream error.

### 3. Contracts

- Public APIs never redirect. They return JSON via `jsonOk` / `jsonError`.
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

### 5. Good/Base/Bad Cases

- Good: browser `fetch()` posts same-origin `FormData` from `/submit` and handles `response.ok`.
- Good: local tests copy `.dev.vars.example` to `.dev.vars` rather than committing a real secret.
- Base: Astro dev may block curl form posts without an `Origin` header; include same-origin `Origin` when testing with curl.
- Bad: letting workerd internal Turnstile/TLS references escape to users as 400 validation errors.
- Bad: adding a development bypass that accepts fake Turnstile tokens in application code.

### 6. Tests Required

- Missing source link/contact/Turnstile token returns JSON failure.
- With a valid local Turnstile secret and network trust chain, a test submission writes `pending`.
- If local workerd rejects the Turnstile TLS certificate chain, verify the route returns a clear 502 and document the environment limit.
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
