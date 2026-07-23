# Brooks-Lint - Full Sweep Report

**Mode:** Full Sweep  
**Scope:** Entire tracked repository: 233 tracked files enumerated; 110 non-`.trellis` files analyzed; 123 Trellis files protected as context. Generated declarations, lockfiles, binary media, and Trellis metadata were not automatic refactor targets.  
**Config:** No `.brooks-lint.yaml` found; balanced defaults applied (all risks enabled, no paths ignored).  
**Health Score:** 74/100  
**Trend:** First run - no prior history data.

The sweep fixed the repository-wide formatting gate without changing public behavior. Four findings remain because they require test infrastructure, a cross-route transaction boundary, or shared validation design rather than a safe local edit.

## Dimension Summary

| Dimension | Scanned | Safe Applied | Extended Applied | Reverted | Residual |
|-----------|---------|--------------|------------------|----------|----------|
| Review (R1-R6) | 110 | 27 files | 0 | 0 | 1 |
| Test (T1-T6) | 78 production files, 0 test files | 0 | 0 | 0 | 1 |
| Debt | 110 | 0 | 0 | 0 | 1 |
| Audit | 110 | 0 | 0 | 0 | 1 |

## Iteration History

Round 1: mixed, 5 findings; one R1 formatting finding was applied as 27 single-file Safe fixes.  
Round 2: clean re-scan of modified files, same-module neighbors, and direct consumers; 0 new findings.  
Stopped at: clean round. No finding exhausted a retry budget; `unresolvable` is empty.

## Fix Log

| # | File | Lines | Risk | Outcome | Change |
|---|------|-------|------|---------|--------|
| 1 | `src/components/**`, `src/layouts/**`, `src/pages/**` (27 files) | formatting-only | R1 | applied | Ran the configured Prettier formatter to restore the repository lint gate and normalize Tailwind utility ordering. |

Existing staged feature changes were preserved and are not counted as sweep fixes.

## Findings

### Critical

**T5 Coverage Illusion - active production paths have no tests [manual]**  
Symptom: `package.json` exposes no test script and the tracked repository contains no test files, while the current work touches authentication, D1 queries, mutation routes, and form validation.  
Source: Feathers - Working Effectively with Legacy Code - legacy code is code without tests.  
Consequence: regressions in auth failure handling, status transitions, audit side effects, and validation boundaries can pass TypeScript and build checks without behavioral protection.  
Remedy: add focused characterization/unit tests for validators and auth, then local D1 integration tests for status/audit/tag invariants before changing those paths again.  
Not applied because: adding a test runner and infrastructure is outside the Safe/Extended-Safe boundary and the task explicitly excludes introducing a new test framework.

### Warning

**R2 Change Propagation - status transitions and audits are split across route adapters [guided]**  
Symptom: `approve`, `reject`, `offline`, `republish`, edit, and tag-merge routes call a mutation helper and then call `insertAudit` separately, for example `src/pages/api/admin/events/[id]/approve.ts:23-28` and `src/lib/db/queries.ts:172-205,540-554`.  
Source: Fowler - Refactoring - Shotgun Surgery; Martin - Clean Architecture - Dependency Rule.  
Consequence: every transition change requires synchronized edits across route files, and an audit insert failure after a successful state mutation leaves the event changed without its audit record.  
Remedy: define a single persistence/application operation that validates the transition and writes the state change plus audit row in one D1 batch, then characterize idempotent and conflict outcomes.  
Not applied because: cross-module transaction design changes a public API/data-integrity boundary and has no test protection.

**R3 Knowledge Duplication - public and admin form policies can drift [guided]**  
Symptom: `src/lib/public/form.ts:49-79` validates canonical dates and `http(s)` URLs, while `src/lib/admin/form.ts:33-70` repeats division/date handling but accepts URL strings without protocol validation and only compares date strings.  
Source: Hunt & Thomas - The Pragmatic Programmer - DRY; Evans - Domain-Driven Design - Ubiquitous Language.  
Consequence: an authenticated edit can persist malformed or non-HTTP link values that are later rendered as clickable event links, while equivalent public and admin inputs receive different validation guarantees.  
Remedy: extract a shared, explicitly named event-field validator with the same error matrix for both form contracts, and add negative tests for invalid dates, schemes, divisions, and same-day times.  
Not applied because: changing accepted admin inputs is a behavior/public-contract decision requiring tests and review.

### Suggestion

**R3 Knowledge Duplication - tag suggestions are implemented twice [quick-fix]**  
Symptom: `FilterBar.svelte` and `TagInput.svelte` each implement the same debounce, request-id race guard, fetch parsing, and empty-result fallback for `/api/tags`.  
Source: Fowler - Refactoring - Duplicate Code; Hunt & Thomas - The Pragmatic Programmer - DRY.  
Consequence: future changes to suggestion timing, response handling, or error states can make the public filter and admin editor behave differently.  
Remedy: extract a small shared tag-suggestion helper with an explicit caller-owned state contract, then add a focused test for stale-response suppression.  
Not applied because: the extraction spans components and needs a deliberate Svelte lifecycle contract; no test suite exists to protect the behavior.

## Architecture Notes

CodeGraph found no confirmed import cycles. `src/lib/db/queries.ts` is large but remains a coherent D1 persistence gateway; it was not split on size alone. UI primitives remain behind the `src/components/ui/` boundary, and application code does not import a second runtime UI library.

## Validation

- `corepack pnpm exec tsc --noEmit`: passed.
- `corepack pnpm exec prettier --check .`: passed after the Safe formatting fixes.
- `corepack pnpm lint`: blocked after Prettier by the known TypeScript 7 / `typescript-eslint` parser incompatibility; no application workaround was applied.
- `corepack pnpm build`: passed; Wrangler emitted an environment-only read-only log warning for `/home/kanade/.config/.wrangler/logs`.
- `git diff --check`: passed for both staged and unstaged changes.
- Fresh local D1 migration: passed with one `0001_init.sql` migration, four application tables, and zero `event_types`, `event_scales`, or `cities` tables. The sandbox required an approved localhost bind; no remote database was accessed.

## Health Score Delta

Before: 73/100 (the formatting gate was still an active R1 suggestion)  ->  After: 74/100  
The score is an estimate using the Brooks balanced deductions; re-run `/brooks-health` for an exact recalculation.

## Summary

- Total findings detected: 5
- Fixed this sweep: 1 finding across 27 files
- Residual (needs human review): 4
- Unresolvable (3-retry exhausted): 0
- No deployment, push, amend, or commit was performed, as required by the Brooks pre-flight contract.
