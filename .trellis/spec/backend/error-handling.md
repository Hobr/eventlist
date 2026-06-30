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

### 5. Good/Base/Bad Cases

- Good: frontend `fetch()` checks `response.ok`, then reads `body.error` only on failure.
- Base: form endpoints accept `FormData` because admin pages submit forms.
- Bad: returning HTML redirects from `/api/admin/*`; browser fetch callers will not surface useful errors.

### 6. Tests Required

- Lint/type/build: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`.
- Route checks once D1 exists:
  - unauthenticated `/api/admin/...` returns 401 JSON.
  - invalid id returns 400 JSON.
  - wrong transition returns 409 JSON.
  - duplicate target transition returns 200 JSON without duplicate audit.
  - duplicate tag merge returns 200 JSON without duplicate audit.

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
