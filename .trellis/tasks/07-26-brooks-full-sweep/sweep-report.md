# Brooks-Lint - Full Sweep Report

**Mode:** Full Sweep

**Scope:** Entire approved repository snapshot: 245 tracked files enumerated; 115 non-`.trellis` files deeply analyzed; 130 Trellis files used as project context. Six task artifacts created after consent are not counted in the original enumeration.

**Config:** No `.brooks-lint.yaml` found; balanced defaults applied (all risks enabled, no paths ignored).

**Health Score:** 69/100

**Trend:** 74 -> 69 (-5) since the 2026-07-23 Full Sweep.

The sweep removed four local sources of drift without changing application behavior. Five risks remain because they require test infrastructure, transaction ownership changes, or shared cross-module contracts rather than a safe local edit.

## Dimension Summary

| Dimension | Scanned | Safe Applied | Extended Applied | Reverted | Residual |
|-----------|---------|--------------|------------------|----------|----------|
| Review (R1-R6) | 115 product/ops files plus applicable specs | 4 | 0 | 0 | 2 |
| Test (T1-T6) | 115 production files, 0 test files | 0 | 0 | 0 | 1 |
| Debt | 115 | 0 | 0 | 0 | 1 |
| Audit | 115 plus dependency graph | 0 | 0 | 0 | 1 |

## Iteration History

Round 1: mixed, 9 findings; four Suggestion-level Safe fixes were applied and five findings were classified Residual.

Round 2: clean re-scan of modified files, same-module neighbors, and direct static consumers; 0 new findings.

Stopped at: clean round. No finding exhausted a retry budget; `unresolvable` is empty.

## Fix Log

| # | File | Lines | Risk | Outcome | Change |
|---|------|-------|------|---------|--------|
| 1 | `.prettierignore` | ignore list | R4 | applied | Excluded the developer-local `.claude/settings.local.json` so local editor state no longer breaks the repository formatting gate. |
| 2 | `src/components/ui/confirm-dialog.svelte` | action tone derivation | R3 | applied | Replaced identical private trigger/confirm tone derivations with one `actionTone` value. |
| 3 | `worker-configuration.d.ts` | generated metadata | R6 | applied | Regenerated the declaration so `wrangler types --check` matches workerd `1.20260722.1`. |
| 4 | `.trellis/spec/backend/database-guidelines.md` | seed compatibility counts | R6 | applied | Updated the executable seed contract from 5 events/4 tags to the verified 17 events/10 tags. |

The pre-existing staged `parseId` reuse in `src/pages/api/admin/tags/merge.ts` was preserved and is not counted as a sweep fix. The externally removed, uncommitted history entry was not reconstructed.

## Findings

### Critical

**T5 Coverage Illusion - active admin, D1, and authentication paths have no behavioral tests [manual]**

Symptom: `package.json` has no test script and no tracked test file exists, while active code includes authentication, status transitions, tag merging, event creation/editing, validation, and D1 mutation workflows.

Source: Feathers - Working Effectively with Legacy Code - legacy code is code without tests.

Consequence: state, audit, authorization, and validation regressions can pass type-check and production build gates without exercising behavior.

Remedy: add focused unit tests for pure validation/auth helpers, then local D1 integration tests for status/audit/tag invariants and route error matrices.

Not applied because: adding a runner or test infrastructure is outside the Safe boundary and the task explicitly excludes new test infrastructure.

### Warning

**R2/R5 Change Propagation - admin mutation workflows do not own one atomic write boundary [guided]**

Symptom: status routes update an event and insert its audit row in separate D1 operations (`src/pages/api/admin/events/[id]/approve.ts:23-28` and peers); tag merge follows the same split (`src/pages/api/admin/tags/merge.ts:22-27`); and `editEvent()` resolves or creates tags before its event/tag batch (`src/lib/db/queries.ts:530-584`).

Source: Fowler - Refactoring - Shotgun Surgery; Martin - Clean Architecture - Dependency Rule; Evans - Domain-Driven Design - Aggregate consistency boundary.

Consequence: an audit failure can leave changed state without audit history, while a later edit failure can leave unused tags or expose a concurrent tag-create conflict before the event update.

Remedy: expose application-level persistence operations that own each mutation, related tag resolution, and audit write as one characterized D1 batch or explicit recoverable workflow.

Not applied because: this is a cross-module data-integrity and transaction redesign with no behavioral test protection.

**R6 Domain Model Distortion - two admin routes map unexpected infrastructure failures to HTTP 400 [guided]**

Symptom: the edit and tag-merge route catch blocks return HTTP 400 for every exception (`src/pages/api/admin/events/[id]/index.ts:24-25`, `src/pages/api/admin/tags/merge.ts:29-30`), while the backend error contract requires validation failures to be 400 and unexpected D1/setup failures to be 500.

Source: Evans - Domain-Driven Design - Ubiquitous Language; Martin - Clean Architecture - boundary error semantics.

Consequence: operators and clients cannot distinguish invalid input from database/setup failure, which weakens monitoring and can prompt users to retry or alter valid data.

Remedy: use typed validation/conflict errors or separate parsing from persistence so route catches can preserve the documented 400/409/500 matrix.

Not applied because: changing observable HTTP behavior is a public contract change and no route tests protect the error matrix.

**R3 Knowledge Duplication - public and admin event form policy has two owners [guided]**

Symptom: `src/lib/public/form.ts` and `src/lib/admin/form.ts` independently implement required/optional fields, canonical dates, HTTP(S) URLs, type/scale membership, division validation, and schedule ordering. Current behavior is aligned, but the policy remains duplicated.

Source: Hunt & Thomas - The Pragmatic Programmer - DRY; Evans - Domain-Driven Design - Ubiquitous Language.

Consequence: a future rule change can reach one entrypoint but not the other, recreating inconsistent accepted data even though both routes write the same event fields.

Remedy: extract narrowly scoped shared field readers/policy with entrypoint-specific labels and fields, backed by a shared validation matrix.

Not applied because: the extraction spans public/admin contracts and lacks tests; preserving exact messages and accepted inputs requires deliberate review.

### Suggestion

**R3 Knowledge Duplication - tag suggestion request behavior is implemented twice [quick-fix]**

Symptom: `src/components/FilterBar.svelte:122-152` and `src/components/TagInput.svelte:51-87` each own the same debounce interval, request-id race guard, `/api/tags` fetch parsing, and stale/empty response handling.

Source: Fowler - Refactoring - Duplicate Code; Hunt & Thomas - The Pragmatic Programmer - DRY.

Consequence: timing, cancellation, or response handling can diverge between public filtering and admin tag editing.

Remedy: extract a small shared tag-suggestion client with caller-owned state and add a focused stale-response test.

Not applied because: the extraction crosses Svelte component lifecycles and there is no test suite to protect race behavior.

## Architecture Notes

CodeGraph found no confirmed import cycle or dependency-direction inversion. `src/lib/db/queries.ts` is large but remains a coherent D1 persistence gateway and was not split on size alone. UI primitives remain behind `src/components/ui/`, and application components do not introduce a second UI runtime.

The committed `wrangler.jsonc` does not contain deployment-specific `ACCESS_TEAM` or `ACCESS_AUD` values. This is not counted as a finding because `README.md` explicitly treats them as pre-deployment configuration rather than repository defaults.

## Validation

- `corepack pnpm exec tsc --noEmit`: passed.
- `corepack pnpm exec prettier --check .`: passed.
- `corepack pnpm lint`: Prettier passed; ESLint remains blocked at startup because `typescript-eslint` 8.65.0 does not support the project's TypeScript 7.0.2, ending in `ERR_INTERNAL_ASSERTION`. This was present before the sweep.
- `corepack pnpm build`: passed; Wrangler emitted only the environment-specific read-only log warning for `/home/kanade/.config/.wrangler/logs`.
- `corepack pnpm exec wrangler types --check`: passed.
- `git diff --check`: passed.
- Fresh local D1 verification: passed with one `0001_init.sql` migration, four strict application tables, no `event_types`, `event_scales`, or `cities` tables, zero initial rows, and seed totals of 17 events, 10 tags, and 24 event-tag relationships. `events` has no foreign keys; `event_tags` has two. The first sandboxed attempt could not bind localhost; the approved retry was local-only and no remote D1 command was used.
- Test suite: not run because no test script or tracked test files exist; this is the Critical T5 residual, not a passing test result.

## Health Score Delta

Before: 65/100 -> After: 69/100

The four verified Suggestion-level fixes recover four points under balanced scoring. The prior-history trend is lower because the current sweep includes new admin-creation/edit surfaces and confirms one additional route error-contract risk. Re-run `/brooks-health` for an exact recalculation.

## Trend Against 2026-07-23

- T5 missing behavioral coverage persists.
- The split mutation/audit boundary persists and now also includes the new edit/tag-resolution surface.
- The previous public/admin validation behavior mismatch is resolved; both parsers now validate canonical dates and HTTP(S) URLs, but duplicated policy ownership remains.
- Duplicated tag suggestion behavior persists.
- The edit/tag-merge HTTP 400/500 mismatch is newly confirmed against the current backend spec.

## Summary

- Total findings detected: 9
- Fixed this sweep: 4
- Residual (needs human review): 5
- Unresolvable (3-retry exhausted): 0
- No dependency, test infrastructure, deployment, remote-data action, commit, amend, or push was performed.
