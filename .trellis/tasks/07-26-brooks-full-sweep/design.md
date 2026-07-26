# Full Repository Brooks Sweep Design

## Architecture and Boundaries

The repository is a single Astro application with these review boundaries:

1. `src/pages/**` and `src/middleware.ts`: page/API adapters, request parsing, response envelopes, and authentication entrypoints.
2. `src/components/**` and `src/layouts/**`: Astro/Svelte presentation, with reusable UI primitives under `src/components/ui/**`.
3. `src/lib/**`: shared policy and application modules for admin validation, auth, event metadata, HTTP responses, runtime bindings, SEO, and D1 persistence.
4. `migrations/**` and `docs/dev/**`: D1 schema and development data contracts.
5. Root configuration and documentation: composition, build, lint, deploy, and contributor contracts.

`src/lib/db/queries.ts` is the current persistence gateway. Pages and routes may orchestrate it, but an automatic cleanup must not move infrastructure concerns into UI/domain modules or redesign exported query contracts. The newly added admin-create path (`AdminEventForm.astro`, `/admin/events/new`, `/api/admin/events`, and its D1 operation) is a priority change surface because it was introduced after the previous sweep.

## Scan Model

Each pass records risk code, file/lines, Iron Law fields, severity, fix class, attempt count, verification command, and outcome:

- Review applies R1-R6 to production and operational code.
- Test applies T1-T6 to discovered tests and identifies unprotected high-risk production behavior. An absent suite is evidence, not success.
- Debt groups repeated R findings and scores Pain (1-3) x Spread (1-3).
- Audit validates dependency direction, cycles, infrastructure leakage, seam quality, and module ownership. Architecture remedies default to Residual unless demonstrably local.

The 245-file consent enumeration is retained for the report. Deep scanning targets 115 non-Trellis files; `.trellis/**`, generated declarations, binary media, and lockfiles are context/protected artifacts rather than speculative refactor targets.

## Safe-Fix Policy

Permitted automatic fixes are mechanically local and behavior-preserving: remove proven dead local code, replace a local magic literal with a private constant, simplify an equivalent private expression, or add a leaf guard whose failure contract already exists.

Extended-Safe work requires a fully passing relevant baseline, at most five files, no export/request/schema behavior change, and focused consumer verification. Because no test suite exists, behavior-changing multi-file work will normally remain Residual even when type-check, lint, and build pass.

Pre-existing changes to `.brooks-lint-history.json` and `src/pages/api/admin/tags/merge.ts` are user-owned. They may be analyzed, but are never reverted, reformatted wholesale, or counted as sweep fixes.

## Verification and Rollback

The baseline and final gate are:

```text
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
git diff --check
```

After each dimension, rerun the smallest relevant subset plus the full gate when the change can affect compilation or production output. If a new failure occurs, apply targeted reverse patches for that dimension in reverse order and rerun verification. Do not use destructive Git operations.

## Iteration and State

The sweep maintains:

- `unresolvable`: finding identity plus retirement reason after three failed attempts.
- `non_critical_rounds`: mixed/non-critical rounds, capped at three.
- `fix_log`: every applied, reverted, or retired fix.
- Per-dimension counts for scanned, Safe, Extended-Safe, reverted, and Residual.

Re-scan only modified files, same-module neighbors, and direct importers. Stop on a clean round or the defined caps.

## Compatibility and Operational Constraints

Preserve route paths, API envelopes, form fields, query parameters, D1 invariants, audit/auth/Turnstile behavior, and the Astro/Svelte/Bits UI stack. Do not introduce dependencies, testing infrastructure, deployments, remote D1 access, or commits. The final report and one appended history record are the only required non-product outputs.

## Report Contract

Write `.trellis/tasks/07-26-brooks-full-sweep/sweep-report.md` using the Full Sweep report structure. Compare the current score with the existing Full Sweep history entries and explain whether the July 22 residuals remain, changed, or were resolved by later work.
