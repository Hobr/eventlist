# Implementation Plan

## 1. Cache Entry Contracts

- [x] Extend `PublicDataCacheKey` so homepage discovery and event list keys include one validated China-local `asOfDate`.
- [x] Extend cache write options with code-owned `cacheTags`; normalize, deduplicate and write them through the `Cache-Tag` response header.
- [x] Add tests for date isolation, tag headers, invalid tag rejection and unchanged DTO/envelope parsing.

## 2. TTL Policy

- [x] Set popularity fresh jitter to 45-55 seconds, normal TTL to 60 seconds and fault TTL to 5 minutes.
- [x] Set homepage, tags and list fresh/normal TTL to 30 minutes; set detail and sitemap fresh/normal TTL to 6 hours; keep fault TTL at 48 hours for all five non-popularity scopes.
- [x] Set successful `/api/popularity` browser caching to `private, max-age=5`; keep other successful public APIs at no more than 15 seconds and errors at `no-store`.
- [x] Update TTL boundary and route-adapter tests for the new policies.

## 3. Global Purge

- [x] Add `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN` to runtime types; declare only the non-secret zone ID in `wrangler.jsonc` and empty secret name in `.dev.vars.example` if that file exists.
- [x] Implement an injected Cloudflare purge client targeting only `https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache` with one deduplicated tag request.
- [x] Add fixed scope tags to each public DTO adapter.
- [x] Extend `schedulePublicDataInvalidation()` to retain bounded local deletes and schedule at most one global purge after public-data-affecting changed admin mutations.
- [x] Map create, bulk create, edit, approve, offline and republish to all six scope tags; map tag merge to `homepage,popularity,tags,detail,list`; map successful pending rejection to no global purge.
- [x] Ensure missing config, fetch failure, non-2xx, invalid JSON, `success:false` and rate limiting log safely and never alter a committed D1 mutation or successful API response.
- [x] Verify successful pending rejection, conflicts, already-target outcomes, validation failures, public submissions and view POSTs do not purge.

## 4. Tests

- [x] Extend `test/public-data-cache.test.ts` for all TTLs, Cache-Tag headers and China-date keys.
- [x] Extend `test/public-data-cache-invalidation.test.ts` for global purge mapping, one-request budget, auth/endpoint/body contract and failure degradation.
- [x] Preserve existing local invalidation, 24-delete limit, privacy, route integration and response-state tests.
- [x] Run `corepack pnpm test`.
- [x] Run `corepack pnpm lint`.
- [x] Run `corepack pnpm exec tsc --noEmit`.
- [x] Run `corepack pnpm build`.
- [x] Run `corepack pnpm exec wrangler types --check`.
- [x] Run `git diff --check`.

## 5. Spec And Configuration

- [x] Update `.trellis/spec/backend/public-data-cache.md` from the historical 60-second/canary contract to the approved global purge and long-TTL contract.
- [x] Set `PUBLIC_DATA_CACHE_SCOPES` to `homepage,popularity,tags,detail,sitemap,list`.
- [x] Resolve the live zone ID read-only and place it in `CLOUDFLARE_ZONE_ID`.
- [x] Store `CLOUDFLARE_CACHE_PURGE_TOKEN` with Wrangler without exposing its value.
- [x] Confirm the stored target-zone Cache Purge token works through the reversible mutation verification.
- [x] Keep the old auto-promotion automation paused.

## 6. Deployment

- [x] Record the current 100% production version and a rollback command before deployment.
- [x] Run Wrangler deploy dry-run and verify bindings contain D1, Assets, Images, SESSION, existing secrets, complete scopes and zone ID.
- [x] Deploy the reviewed version at 100%; no gradual canary or CPU/usage gate is required by the current user decision.
- [x] Verify all six public routes with repeated response hashes: five positive surfaces reached `MISS -> HIT`, while empty-D1 detail correctly remained `404 MISS -> MISS` and uncached.
- [x] Perform one reversible admin mutation, confirm global purge success and post-purge `MISS`, restore the original data, then confirm a second purge.
- [x] Keep the recorded Worker Version and scope-reduction rollback procedures ready; no response inconsistency occurred, so neither rollback was used.

Production baseline recorded on 2026-08-01:

- Current 100% version: `210dcb4f-3d9c-4199-a64b-c5d97d2a5be8`.
- Rollback command: `corepack pnpm exec wrangler rollback 210dcb4f-3d9c-4199-a64b-c5d97d2a5be8 --message "cache: rollback public DTO cache deployment"`.
- `CLOUDFLARE_CACHE_PURGE_TOKEN` is present by name in `wrangler secret list`; storing it created the current secret-triggered version and unblocked deployment. The reversible production mutation below confirmed the stored token can purge Cache-Tag entries in the target zone.

Production rollout completed on 2026-08-01:

- Deployed version: `5864145e-3824-4ea8-9c80-eded7ec88e0f`; deployment: `b4be4c0b-de3f-4e82-b7f5-08405b0beb57`; traffic: `100%`.
- Deployment message: `cache: activate six public DTO scopes with global tag purge`.
- Full gates passed: `135/135` tests, lint, TypeScript, production build, Wrangler types check, deploy dry-run and `git diff HEAD --check`.
- Initial positive production surfaces showed byte-identical `MISS -> HIT`: homepage, popularity, tags, list and sitemap. At deployment time the remote D1 database contained `0` events, so `/events/1` correctly showed byte-identical `404 MISS -> MISS`; negative detail results remain uncached by contract.
- No response inconsistency occurred and rollback was not used. The secret-enabled baseline `210dcb4f-3d9c-4199-a64b-c5d97d2a5be8` remains the rollback target.
- After production received real event data, all six surfaces were warmed to `HIT`, including positive detail `/events/2`. The authenticated admin edit temporarily changed event 2's source URL by adding `#cache-purge-check-20260801`; the next request to homepage, popularity, tags, list, detail and sitemap returned `200 MISS` for every surface.
- Restoring the exact original source URL triggered a second purge; the next request to all six surfaces again returned `200 MISS`, followed by `200 HIT` on the subsequent request. A remote D1 read confirmed event 2's source URL is exactly `https://show.bilibili.com/platform/detail.html?id=1003089`, with `changed_db=false` and `rows_written=0` for the verification query.

## 7. Completion

- [x] Run Trellis quality check and resolve findings.
- [x] Record production version, deployment, scope, rollback version, and mutation-based purge evidence in the parent implementation log.
- [x] Update the relevant cache spec.
- [x] Commit all scoped changes and archive/finish the child task.
