# Research: Automatic Scope Promotion

- Query: 在 `tags,sitemap` 生产 pilot 后，如何自动扩大到 homepage、popularity、detail、list，并在 Cloudflare Workers 上按健康信号自动 fail-closed/rollback；确认运行时是否能安全修改 Wrangler vars，以及不增加付费服务、D1 继续作为事实来源时的最小可实施设计。
- Scope: mixed
- Date: 2026-07-31

## Findings

### 1. Current integration readiness

The initial research snapshot found the cache core ahead of route integration. The subsequent Phase 2 implementation now integrates `homepage`, `popularity`, `detail`, and `list` loaders into their public routes with contextual DTO guards, TTLs, response states, and tests. Production configuration remains limited to the previously approved `tags,sitemap` pilot, so this code is integrated but fail-closed until the external promotion gates pass.

| Scope | What is ready | Exact remaining blockers | Promotion recommendation |
| --- | --- | --- | --- |
| Homepage | Shared discovery/popularity loaders now serve SSR and `/api/homepage`; SSR keeps `Promise.allSettled()` isolation and the API remains all-or-nothing. | Existing production sample was p50/p99 15/63 ms, above the 10 ms gate; the external controller and fresh response-equivalence evidence are not implemented. | Promote after popularity, only with a new passing CPU baseline and complete probe evidence. |
| Popularity | The canonical division/window key, contextual guard, 25-35 s fresh TTL, API headers, and shared route integration are complete. | The automatic controller, observation window, and production health evidence are still absent. | First automatic candidate, matching the parent PRD's fixed sequence. |
| Detail | The v2 static DTO loader is integrated, binds cached ID to the key, rejects negative caching, keeps visitor heat separate, and preserves the view beacon. | Write-after-mutation invalidation and the external controller remain; the prior detail CPU p99 sample was 58 ms. | Defer until the detail CPU gate and published/offline/negative probes pass. |
| List | The page uses the shared top-tags loader and a contextual page loader; only pages 1-3 with bounded normalized filters are admitted. | High-cardinality invalidation remains TTL-only; the prior list CPU p99 sample was 193 ms and no repeat-hit evidence exists. | Last, after measured repeat traffic and a passing CPU gate. |

Common integration blockers:

- The production pilot is explicitly limited to `tags,sitemap`; the task record says the one-time usage exception does not extend to homepage, popularity, detail, list, or view dedupe (`implement.md:204-214`).
- Current mutation routes discard useful `MutationImpact` values. The DB functions already return event IDs and old/new divisions for edit/status transitions (`src/lib/db/admin-events.ts:176-267`, `:557-727`) and affected event IDs for tag merge (`:750-877`), but routes return JSON without scheduling invalidation (`src/pages/api/admin/events/[id]/index.ts:22-35`, `approve.ts:14-24`, `merge.ts:31-40`). Creates/bulk creates return IDs but do not return a cache impact object (`admin-events.ts:337-449`, `:451-545`).
- There is no public cache invalidation helper and no `delete()` in the store interface. The approved design caps known home/popularity deletes at 24 keys for old/new ancestor divisions and leaves high-cardinality list/search keys to the 60-second TTL (`design.md:294-322`).
- The temporary production probe source has been removed. Tests must keep asserting that it is absent before any future build or deployment.

### 2. Smallest production-safe automatic rollout

Use two independent safety layers:

1. **Runtime fail-closed (already partly present):** keep `PUBLIC_DATA_CACHE_SCOPES` as a hard upper bound. Unknown/empty scope values must resolve to no cache, `cache.match()` failures are misses, invalid DTO/envelopes are misses, and `cache.put()` failures preserve the successful D1 response (`public-data.ts:111-125`, `:358-417`, `:441-512`). A disabled scope must never call `match` or `put`. This protects correctness when the control plane is down.
2. **Deployment-level staged promotion:** build a new Worker Version whose only behavioral change is the next scope set, then use Cloudflare gradual deployment percentages (for example 5% -> 25% -> 50% -> 100%). Keep the previous version as the stable rollback target. Do not mix schema migrations or unrelated code changes into an auto-promoted version. The existing namespace/schema key versioning means a version that bypasses a scope will ignore candidate cache entries; a rollback therefore does not require purging Cache API objects.

The smallest control-plane implementation is a scheduled CI job (GitHub Actions or an equivalent already-approved scheduler) that:

- reads current deployment/version state and uses a per-worker concurrency lock;
- uploads a candidate with the next checked-in scope set and a deterministic version tag, then deploys a percentage using `wrangler versions upload` / `wrangler versions deploy`;
- waits for a fixed observation window and requires all signals to be present; missing metrics, probe failures, or ambiguous deployment state never promote;
- promotes exactly one scope at a time in the fixed order `popularity` -> `homepage` -> `detail` -> `list`;
- on a failed health gate, deploys the last stable version at 100% (or calls `wrangler rollback`), then records the reason and freezes further promotion.

This uses no new paid data service. D1 remains the only source of truth for events, tags, moderation state, and visitor heat. Cache API data and deployment variables are optimization/configuration state only. A single manual deployment can raise the hard upper-bound env value to all code-supported scopes; subsequent stage changes should be driven by the external controller, not by editing production data.

Health gates should be conservative and fail closed:

- Cloudflare Workers GraphQL metrics for the observation window: requests, errors, `exceededCpu`, and CPU p50/p99. The documented `workersInvocationsAdaptive` query exposes `sum.errors`, `sum.requests`, `quantiles.cpuTimeP50`, `quantiles.cpuTimeP99`, and status dimensions (Workers GraphQL tutorial, 2026-04-23).
- Fixed HTTP probes for every candidate route, asserting status, `X-Eventlist-Cache` state, stable body hash, and no internal error. For homepage, probe both a fixed valid division and each homepage API contract; for detail, probe one published and one offline event and verify no beacon regression; for list, probe default filters and pages 1-3.
- D1 source comparison for probe DTOs: load the same representative rows from D1 and compare the explicit public projection to the cache response. Any mismatch, stale data beyond the approved bound, or unexpected 4xx/5xx freezes promotion.
- Keep the existing hard limits: candidate route CPU p99 must remain below 10 ms, `exceededCpu` must be zero, and the aggregate error rate must not exceed an explicit baseline threshold. The current task does not define a numeric error-rate delta; choose and record it before implementation.

For automatic fail-closed, the controller must treat GraphQL/API timeout, stale metrics, probe mismatch, deployment propagation uncertainty, and missing stable-version ID as failures. The runtime continues to serve D1 directly when the scope env is empty or a cache operation fails. Rollback changes Worker traffic/version only; it must not delete or rewrite D1 facts.

### 3. Runtime self-modification versus a control plane

The Worker cannot safely mutate its own Wrangler vars as a normal runtime operation. Wrangler vars are deployment configuration/bindings, and every version captures the complete code/configuration state. The runtime can read `env` values, but changing them requires a new version/deployment through Wrangler, the Workers API, or the dashboard. `wrangler versions upload` does expose `--var` and `--keep-vars`, but those are upload-time flags, not a runtime API (`corepack pnpm exec wrangler versions upload --help`).

Giving the Worker a Cloudflare API token capable of uploading/deploying/rolling back itself would create a privileged self-deploy loop: a bad release could revoke or misuse its own recovery path, concurrent Cron invocations could race, and Wrangler's config source of truth could diverge from the deployed state. Do not put a Workers Script write token in the public Worker.

An existing Worker Cron can safely run read-only probes and write a D1 rollout/audit row, but it cannot by itself change `PUBLIC_DATA_CACHE_SCOPES` or traffic percentages. A D1-controlled runtime gate is a viable future variant (one small control table, cached for <=30 s, read failures yield an empty scope set), but it requires new per-request control-state plumbing and still cannot observe Cloudflare CPU/1102 aggregate health without an analytics API credential. It is not smaller than the deployment controller for the current code.

### 4. Recommended acceptance criteria

- Each newly integrated loader has an explicit public DTO guard, canonical key, scope gate, TTL/fault-stale bound, `X-Eventlist-Cache` state, and D1 fallback. Homepage SSR keeps `Promise.allSettled()` isolation; `/api/homepage` keeps all-or-nothing semantics.
- The detail loader never caches a negative result, never includes visitor counts or private event fields, and never removes the view beacon unless the separate dedupe contract is explicitly enabled and proven.
- `/events` cache admission is limited to pages 1-3 and bounded canonical filters; pages outside the admission set are transparent D1 bypasses. Top tags use the existing tag loader instead of a second direct D1 read.
- Admin create/edit/status/tag mutations schedule best-effort invalidation only after D1 and audit success. Known home/popularity/detail/tag/sitemap keys are deleted with a bounded fan-out; list/search keys rely on the hard 60-second TTL. Delete failure never changes the successful mutation response.
- A candidate deployment is never promoted when metrics/probes are missing or ambiguous. Required stage gates are recorded as machine-readable evidence: candidate version ID/tag, percentage, window, request count, error count/rate, `exceededCpu`, CPU p50/p99, probe hashes, D1 comparison result, and decision.
- A failed gate immediately returns traffic to the last stable version at 100%, freezes the next stage, and leaves D1 untouched. The empty-scope version remains a tested emergency rollback target.
- Auto promotion remains disabled until fresh production baselines exist. The current record has only a short pilot sample and explicitly notes that homepage/detail/list CPU gates are not met (`implement.md:195-214`).
- Deployment tests cover split-version cache isolation, rollback to the stable version, config/env absence, Cache API failure, D1 failure, stale-if-error, and propagation delay. No test may rely only on local Miniflare for Cache API production capability.

### 5. Clarification boundary

User clarification is **not mandatory** if “自动扩大” means conservative whole-scope promotion with the inherited order, a documented observation window, and fixed thresholds chosen by the implementation owner. The code can safely default to no promotion on uncertainty.

Clarification **is mandatory before implementation** if the request means percentage canaries within one Worker version, candidate-specific per-route SLOs, or automatic deployment authority from inside the Worker. The current repository has no agreed percentage schedule, error-rate delta, observation window, or route-level analytics source; choosing those changes the operational risk rather than being a mechanical implementation detail.

## Files Found

- `src/lib/cache/public-data.ts` - scope registry, canonical keys, envelope state machine, and fail-closed cache helpers.
- `src/lib/cache/public-routes.ts` - contextual guards and route loaders for all six public DTO scopes.
- `src/lib/cache/cloudflare.ts` - Cache API store with `match`/`put`, no invalidation delete.
- `src/lib/db/homepage.ts` - homepage discovery and popularity D1 batch loaders.
- `src/lib/db/public-events.ts` - public event/list/detail DTOs and canonical D1 queries.
- `src/lib/db/views.ts` - recent visitor count, exact view upsert, and Cron cleanup.
- `src/pages/index.astro` - IP/query/default division resolution and SSR error isolation.
- `src/pages/api/homepage.ts` and `src/pages/api/popularity.ts` - shared cached loaders with preserved API error contracts.
- `src/pages/events/index.astro` - normalized list filters plus shared top-tags/list loaders.
- `src/pages/events/[id].astro` - cached static detail, separate recent count, 404/offline semantics, and non-blocking view beacon.
- `src/pages/api/tags.ts` and `src/pages/sitemap.xml.ts` - active pilot route integrations.
- `src/pages/api/admin/**` and `src/lib/db/admin-events.ts` - mutation routes and impact metadata without cache invalidation hooks.
- `src/worker.ts` and `wrangler.jsonc` - existing scheduled cleanup and deployment variables; no rollout controller.
- `.trellis/tasks/07-28-d1-cache-strategy/{prd.md,design.md,implement.md}` - accepted cache contracts, TTL/invalidations, release order, CPU gates, and current pilot evidence.
- `.trellis/spec/backend/public-data-cache.md` - production hostname, fail-closed, CPU, and cache test requirements.
- `test/public-data-cache.test.ts` - cache-core tests; no full route/promotion controller tests.
- `src/pages/eventlist-cache-probe-v1.ts` - intentionally absent after the completed production probe.

## External References

- [Workers Versions & deployments](https://developers.cloudflare.com/workers/versions-and-deployments/index.md), last updated 2026-07-03: a version captures code/configuration and a deployment can split traffic across versions.
- [Gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/index.md), last updated 2026-07-03: upload versions separately, split traffic, observe, and promote/rollback; version metadata can identify the serving version.
- [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/index.md), last updated 2026-07-15: rollback sends 100% traffic to the selected version and does not change connected storage resources.
- [Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/index.md), last updated 2026-06-20: vars are bindings/configuration supplied to `env`; deploy/dashboard changes are configuration changes, not runtime mutation.
- [Bindings (`env`)](https://developers.cloudflare.com/workers/runtime-apis/bindings/index.md), last updated 2026-07-22: bindings are capabilities supplied to the Worker; deploy-time binding changes can reuse isolates, so global derived clients must not assume old values disappear.
- [Querying Workers metrics with GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/index.md), last updated 2026-04-23: `workersInvocationsAdaptive` exposes request/error sums, CPU p50/p99, and status dimensions with an Analytics API token.
- [Metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/index.md), last updated 2026-07-01: Workers metrics are aggregate per Worker; invocation statuses distinguish script exceptions and exceeded resources.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/index.md), last updated 2026-07-28: Free CPU is 10 ms for HTTP and Cron, subrequests are 50/request, and Cache API calls share that quota.
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/index.md), last updated 2026-06-20: scheduled handlers run on UTC Cron and trigger propagation can take up to 15 minutes.
- [Wrangler `versions upload --help`](local Wrangler 4.116.0): `--var`, `--keep-vars`, `--tag`, and `--message` are upload-time controls; `versions deploy` supports percentage splits and `rollback` selects a prior version.

## Related Specs

- `.trellis/spec/backend/public-data-cache.md:24-32` - synthetic key, fail-closed, real-host probe, CPU gate, and pilot prerequisites.
- `.trellis/spec/backend/public-data-cache.md:38-65` - error matrix, cache tests, and required quality commands.
- `.trellis/tasks/07-28-d1-cache-strategy/prd.md:28-55` - D1 authority, 60-second staleness, invalidation, CPU, and subrequest contracts.
- `.trellis/tasks/07-28-d1-cache-strategy/design.md:104-180` - key normalization, TTLs, and stale state machine.
- `.trellis/tasks/07-28-d1-cache-strategy/design.md:294-322` - write-after-mutation invalidation and bounded ancestor fan-out.
- `.trellis/tasks/07-28-d1-cache-strategy/design.md:441-477` - observability, staged release, and rollback switches.
- `.trellis/tasks/07-28-d1-cache-strategy/implement.md:107-153` - pending route integration, invalidation, list admission, and tests.
- `.trellis/tasks/07-28-d1-cache-strategy/implement.md:182-214` - current production pilot, metrics, exception, and rollback record.

## Caveats / Not Found

- No product code was modified by this research.
- The current worktree has no CI workflow for deployment control; adding one is a new operational artifact and needs repository-owner approval for its Cloudflare API token scope.
- Cloudflare's documented Workers GraphQL example exposes Worker-level metrics; it does not establish a route-level CPU/error breakdown for this repository. A controller using only aggregate metrics must use conservative global thresholds, or add a separately approved version/log attribution mechanism.
- Cloudflare Cache API is data-center-local. A scope disable/rollback through a new version makes old versions bypass the scope, but cached objects may remain physically present until expiry; correctness relies on bypass, not global purge.
- Gradual deployment with a changed D1 schema/binding is not an acceptable automatic candidate. Keep schema migrations and cache rollout in separate releases so the stable rollback version remains compatible.
- Current production pilot evidence is short and includes a one-time `tags,sitemap` capacity exception. It is not evidence that homepage, popularity, detail, or list should be promoted automatically.
