# Brooks Full Sweep Execution

- Date: 2026-08-03
- Mode: Full Sweep
- Strictness: balanced default (`.brooks-lint.yaml` is absent)
- Baseline commit: `943cfdf`
- Stop condition: one clean modified-scope re-scan, no unresolved Critical finding
- Git policy: no commit, push, amend, deploy, or remote D1 operation

## Summary

The sweep completed in the required `Review -> Test -> Debt -> Audit` order. It found 15
Iron Law findings, applied seven Safe or Extended-Safe remedies, and retained eight
non-Critical residuals. No production API, route, form, public DTO, D1 transaction, cache,
privacy, or UI-system contract changed.

| Result | Count |
| --- | ---: |
| Findings | 15 |
| Fixed | 7 |
| Residual | 8 |
| Unresolvable | 0 |
| Reverted production fixes | 0 |
| Critical remaining | 0 |

## Scope Enumeration

The baseline manifest is the exact output of `git ls-files` at `943cfdf`: 409 paths with
SHA-256 `05cd9966ca76f9bb108b67863096231849864171d069b2faa1f1d8631cb26147`.

| Baseline area | Files | Treatment |
| --- | ---: | --- |
| `.trellis/` | 233 | Task/spec/contract consistency |
| `src/` | 118 | Full semantic scan |
| `test/` | 22 | Full test-quality scan |
| `migrations/` | 1 | Schema/contract consistency |
| Remaining tracked files | 35 | Config, docs, scripts, dependencies, and asset consistency |
| **Total** | **409** | Full repository scope |

Generated declarations, lock files, and binary/static assets were checked for drift and
dependency consistency, but machine-generated detail was not treated as handwritten decay.
The six untracked task inputs were also read: `check.jsonl`, `design.md`, `implement.jsonl`,
`implement.md`, `prd.md`, and `task.json`. Sweep-created `src/lib/events/input.ts` and
`test/admin-auth.test.ts` were included in the re-scan. The exact baseline path manifest is
in Appendix A.

## Baseline

The worktree contained only the active untracked task assets before implementation.

| Gate | Baseline result |
| --- | --- |
| `corepack pnpm test` | PASS, 135 tests |
| `corepack pnpm exec tsc --noEmit` | PASS |
| `corepack pnpm build` | PASS |
| `corepack pnpm lint` | PASS |
| `corepack pnpm exec wrangler types --check` | FAIL, generated bindings omitted `CLOUDFLARE_CACHE_PURGE_TOKEN` |
| `git diff --check` | PASS |

Running the package manager briefly exposed a lockfile resolution-only drift. The exact
sweep-created lockfile diff was reversed before code work; `pnpm-lock.yaml` is absent from
the final diff.

## Dimension Summary

| Dimension | Risks scanned | Findings | Fixed | Residual |
| --- | --- | ---: | ---: | ---: |
| Review | R1-R6 | 6 | 3 | 3 |
| Test | T1-T6 | 5 | 2 | 3 |
| Debt | Pain x Spread, drift, duplication, workaround clusters | 2 | 1 | 1 |
| Audit | direction, cycles, fan-in/out, seams, god modules | 2 | 1 | 1 |
| **Total** |  | **15** | **7** | **8** |

R6 DTO candidates were rejected as false positives because the explicit field lists are
intentional trust-boundary whitelists. No T4 mock-abuse or T6 test-framework mismatch was
verified. No import cycle was found.

## Applied Findings and Fix Log

### F-01 — Generated environment contract drift

- Risk / severity / Fix-Class: R3 / Warning / Safe
- Location: `worker-configuration.d.ts:17,30`; source contract in `wrangler.jsonc`
- Symptom: Wrangler's generated `Env` and `ProcessEnv` types omitted the configured cache
  purge token.
- Source: the checked-in declaration had not been regenerated after the environment key was
  introduced.
- Consequence: runtime configuration and compile-time environment discovery disagreed, and
  `wrangler types --check` failed.
- Remedy: regenerated the declaration with `corepack pnpm exec wrangler types`; no secret
  value was read or recorded.

### F-02 — Unused edit snapshot aggregate

- Risk / severity / Fix-Class: R4 / Suggestion / Safe
- Location: `src/lib/db/admin-events.ts:545-571` (pre-fix snapshot query)
- Symptom: `editEvent()` selected all canonical tag IDs through a correlated aggregate, then
  parsed and discarded the JSON.
- Source: stale inspection logic remained after tag reconciliation moved into the atomic D1
  batch.
- Consequence: every edit paid unnecessary SQL and JSON work and implied a validation
  invariant that did not exist.
- Remedy: removed only the unused projection and parse; status/division snapshot behavior and
  D1 call count remain covered by mutation tests.

### F-03 — Positional D1 batch result knowledge

- Risk / severity / Fix-Class: R2 / Suggestion / Safe
- Location: `src/lib/db/admin-events.ts:684-714,843-864`
- Symptom: edit and tag-merge outcomes were decoded through raw `results[0]`, `results[1]`,
  `results[3]`, and similar indexes.
- Source: statement meaning was encoded only by array position.
- Consequence: inserting or reordering a statement could silently attach audit, tag, or probe
  semantics to the wrong result.
- Remedy: destructured named result variables while retaining the exact statement order,
  atomic batch, and public return contracts.

### F-04 — Eager homepage source-contract test

- Risk / severity / Fix-Class: T1 / Suggestion / Safe
- Location: `test/public-homepage.test.ts:24,288-346`
- Symptom: one test loaded eight implementation files and mixed snapshot race, island
  composition, popularity history, and location-shell assertions.
- Source: successive homepage behaviors accumulated in one setup and assertion block.
- Consequence: a failure did not identify the broken behavior and unrelated source reads made
  the test harder to change safely.
- Remedy: introduced one local source reader and split the block into four behavior-named
  tests without weakening assertions.

### F-05 — Missing direct authentication primitive coverage

- Risk / severity / Fix-Class: T5 / Warning / Safe
- Location: `src/lib/auth/access.ts:75-122`, `src/lib/auth/token.ts:45-52`;
  `test/admin-auth.test.ts:72-104`
- Symptom: token comparison/cookie decoding and Access JWT signature/claim validation had no
  direct regression test.
- Source: authentication had only runtime callers and no Node-compatible seam test.
- Consequence: a fail-open regression in signature, audience, expiry, cookie decoding, or
  token equality could pass the previous suite.
- Remedy: added tests using WebCrypto-generated RS256 keys and an in-process JWKS response;
  valid, tampered, wrong-audience, expired, malformed, missing, and malformed-cookie cases are
  covered without external network access.

### F-06 — Historical lint exception remained executable guidance

- Risk / severity / Fix-Class: R3 / Warning / Extended-Safe
- Location: `.trellis/spec/frontend/design-system.md:426-431` and
  `.trellis/spec/backend/database-guidelines.md:373`
- Symptom: two current specs still allowed ESLint to be skipped for a parser 8.64 / TypeScript
  7 incompatibility.
- Source: the toolchain advanced to parser 8.65 and ESLint 10.8, but the historical exception
  was not retired.
- Consequence: a real lint regression could be accepted by following stale project guidance.
- Remedy: documented `corepack pnpm lint` as a normal hard gate while retaining the ban on
  dependency downgrades or patches used merely to suppress failures.

### F-07 — Validation contracts owned by D1 adapters

- Risk / severity / Fix-Class: R5 / Warning / Extended-Safe
- Location: `src/lib/admin/form.ts:1`, `src/lib/public/form.ts:1`, former declarations in
  `src/lib/db/admin-events.ts:44` and `src/lib/db/submissions.ts:10`
- Symptom: public/admin validation modules imported their input shapes from persistence
  adapters.
- Source: `EventBaseInput`, `SubmissionInput`, and `AdminEventInput` were declared beside D1
  write implementations instead of the event domain.
- Consequence: form/validation policy depended inward on D1 modules, increasing change
  propagation and obscuring the domain boundary.
- Remedy: moved the type-only contracts to `src/lib/events/input.ts`; switched the two
  validators and both adapters to the domain type, and preserved compatibility re-exports at
  the old database paths. The batch was capped at exactly five files and changed no runtime or
  public signature.

## Technical-Debt Scoring

Pain and Spread use the task's 1-3 scales. Systemic Review/Test findings are shown here for
prioritization but are counted only in their original dimension totals.

| Finding | Pain | Spread | Score | State |
| --- | ---: | ---: | ---: | --- |
| Historical lint exception | 2 | 2 | 4 | Fixed |
| D1 database identity drift | 3 | 2 | 6 | Residual |
| Synchronous `getDB()` awaited | 1 | 3 | 3 | Residual, Review count |
| Browser JSON decoding duplication | 2 | 3 | 6 | Residual, Review count |
| Admin queue page duplication | 2 | 2 | 4 | Residual, Review count |
| Source-regex test coupling | 2 | 3 | 6 | Residual, Test count |
| D1 fake/fixture duplication | 2 | 2 | 4 | Residual, Test count |
| Admin mutation transaction façade | 3 | 3 | 9 | Residual, Audit count |

## Residual Findings

### R-01 — Synchronous `getDB()` is awaited across route code

- Risk / severity / Fix-Class: R4 / Suggestion / Residual
- Location: `src/lib/db/index.ts:12`; 21 callers including `src/pages/index.astro:78` and
  `src/pages/api/homepage.ts:63`
- Symptom: a synchronous binding accessor is consistently written as `await getDB(...)`.
- Source: call sites retained an older asynchronous mental model even though the executable
  database spec requires no D1 probe.
- Consequence: readers cannot tell where actual I/O and rejection boundaries begin, and new
  callers are likely to perpetuate the false contract.
- Remedy: remove the redundant awaits in a dedicated mechanical refactor. It exceeds the
  five-file Extended-Safe batch cap, so it was not automated here.

### R-02 — Browser response-envelope decoding is repeated and cast locally

- Risk / severity / Fix-Class: R3 / Warning / Residual
- Location: ten callers, including `src/pages/submit.astro:423`,
  `src/components/NavLocationPicker.svelte:128`, `src/components/HomepagePopularity.svelte:167`,
  and `src/components/admin/BulkEventImport.svelte:78`
- Symptom: callers independently run `response.json().catch(() => null)` and cast slightly
  different envelope shapes.
- Source: the server owns shared JSON helpers, but browser consumers have no shared validated
  decoder.
- Consequence: an envelope drift can be interpreted differently across public/admin UI, and a
  successful HTTP response can still become unsafe unchecked data.
- Remedy: design a browser-safe envelope decoder with DTO-specific guards and tests, then
  migrate Astro and Svelte consumers together. That cross-framework contract change is beyond
  the sweep's safe boundary.

### R-03 — Three admin queue pages duplicate loader and page composition

- Risk / severity / Fix-Class: R3 / Suggestion / Residual
- Location: `src/pages/admin/index.astro:1`, `src/pages/admin/offline.astro:1`, and
  `src/pages/admin/published.astro:1`
- Symptom: the routes repeat status selection, D1 loading, pagination, error handling, table,
  and pager composition with only status/copy/mode differences.
- Source: each queue was introduced as a concrete page without a shared queue loader or page
  component.
- Consequence: pagination, failure-state, or moderation-table changes must remain synchronized
  in three places.
- Remedy: introduce a typed queue configuration and shared page composition after route-render
  regression coverage exists. Extraction crosses Astro route boundaries and is not Safe.

### R-04 — Source-regex tests are coupled to implementation spelling

- Risk / severity / Fix-Class: T2 / Warning / Residual
- Location: source-reading assertions in ten test files, including
  `test/public-homepage.test.ts:278-360`, `test/public-data-cache.test.ts`,
  `test/admin-mutation-db.test.ts`, and `test/event-detail.test.ts`
- Symptom: many tests validate behavior through regexes over source strings.
- Source: the suite uses static source contracts where Astro/Svelte/Workers runtime seams are
  not available to the bare Node runner.
- Consequence: behavior-preserving formatting/refactors can fail while semantically broken
  code with matching text can pass.
- Remedy: replace the highest-risk assertions incrementally with executable route/component
  harnesses. Adding Playwright is forbidden, and no equivalent project harness currently
  exists, so broad migration remains Residual.

### R-05 — D1 fakes and valid-event fixtures are duplicated with divergent semantics

- Risk / severity / Fix-Class: T3 / Suggestion / Residual
- Location: fake classes in `test/homepage-discovery.test.ts:7`,
  `test/d1-query-write-optimization.test.ts:22`, `test/admin-mutation-db.test.ts:14`,
  `test/admin-create-merge-db.test.ts:13`, and `test/admin-bulk-db.test.ts:37`; repeated
  `VALID_EVENT` shapes in four files
- Symptom: several suites define similarly named statement/database fakes and large event
  fixtures.
- Source: each fake evolved distinct queueing, `first`/`all`/`run`, batch, and query-budget
  behavior.
- Consequence: contract fixes and new event fields require parallel fixture maintenance, while
  an over-generalized helper could erase intentional test differences.
- Remedy: first specify the minimum shared D1 fake protocol and fixture builder, preserving
  suite-specific behavior as adapters. Intent is not yet clear enough for a mechanical merge.

### R-06 — Middleware authentication orchestration lacks an executable Node seam

- Risk / severity / Fix-Class: T5 / Warning / Residual
- Location: `src/lib/auth/admin.ts:11-31` and `src/middleware.ts:1-33`
- Symptom: authentication primitives are now covered, but page/API matching, 401 JSON,
  login bypass, redirect, and `locals.admin` composition are not executed by tests.
- Source: importing the orchestration under the current Node test runner reaches the
  `cloudflare:workers` URL scheme and fails before tests run.
- Consequence: middleware wiring can regress even when token and JWT verification remain
  correct.
- Remedy: add a Workers/Astro-compatible middleware harness or extract a framework-neutral
  decision function under a separately approved, tested refactor. The sweep did not alter
  production auth architecture merely to enable a test.

### R-07 — Runtime and executable spec disagree on the D1 database ID

- Risk / severity / Fix-Class: R3 / Warning / Residual
- Location: `wrangler.jsonc:53` has `0a13eb44-0eb6-4513-9b91-5a02eaac570f`;
  `.trellis/spec/backend/database-guidelines.md:13` has
  `b11ea70c-4597-4049-a650-718cfbc5b04f`
- Symptom: the same `eventlist-db` binding has two asserted identifiers.
- Source: deployment history changed the runtime configuration without updating the database
  spec, or the config points at a replacement database that has not been verified here.
- Consequence: following the wrong source of truth can target an unintended remote database.
- Remedy: an authorized operator must perform a read-only remote D1 inventory check, decide
  the current database of record, and then align the losing document/config. Remote D1 access
  was explicitly out of scope, so neither value was guessed or changed.

### R-08 — Admin mutation persistence remains a high-blast-radius transaction façade

- Risk / severity / Fix-Class: R1 / Warning / Residual
- Location: `src/lib/db/admin-events.ts:132-866`; 17 static importers
- Symptom: one 868-line module owns queue reads, state transitions, duplicate discovery, bulk
  creation, single creation, edits, tag merges, audit coupling, and mutation-impact models.
- Source: atomic D1 workflows accumulated behind one persistence façade.
- Consequence: unrelated mutation changes share a large review surface, and the module's fan-in
  amplifies accidental contract changes.
- Remedy: preserve the public façade while extracting internal transaction modules by
  workflow, with existing query-count, rollback, idempotency, and audit tests guarding every
  move. That is a structural, multi-module refactor beyond Extended-Safe limits.

## Architecture Audit

A static import graph after the type-boundary fix contained 117 source modules and 385
internal edges with zero strongly connected components larger than one. High fan-out entries
were Astro composition roots; high fan-in entries were runtime/database utilities or explicit
facades. No dependency from the new event input domain to D1, pages, components, cache, or
runtime bindings was introduced.

The scan also confirmed no `bits-ui`, Lucide, `initFlowbite()`, Material token/font,
Playwright, second UI runtime, or second D1 source was introduced.

## Iteration History

| Round | Scope | Result | Action |
| --- | --- | --- | --- |
| 0 | Baseline | Mixed | Recorded one generated-type failure; all other gates green |
| 1 | Review R1-R6 | Mixed | Three fixes applied; three non-Critical residuals retained |
| 2 | Test T1-T6 | Mixed | Homepage test split and direct auth primitive tests applied; three residuals retained |
| 3 | Debt | Mixed | Lint-spec drift fixed; remote D1 identity retained |
| 4 | Audit | Mixed | Type dependency direction fixed; transaction façade retained |
| 5 | Modified files, neighbors, and importers | Clean | No new Critical/Warning introduced; stop condition met |

The first auth-test attempt imported the framework orchestration and failed with Node's
unsupported `cloudflare:` URL scheme. The same finding's test batch was narrowed to the pure
token/JWT seams and passed on retry; no production fix was reverted, and the untestable
middleware seam is explicitly R-06. `unresolvable = 0`; `non_critical_rounds = 1`.

## Final Validation

| Gate | Final result |
| --- | --- |
| `corepack pnpm test` | PASS, 140 tests |
| `corepack pnpm exec tsc --noEmit` | PASS |
| `corepack pnpm build` | PASS |
| `corepack pnpm lint` | PASS |
| `corepack pnpm exec wrangler types --check` | PASS |
| `corepack pnpm exec prettier --check .` | PASS |
| `git diff --check` | PASS |
| Forbidden-pattern scan | PASS, no matches |

No remote D1 command, deployment, dependency downgrade, Playwright installation, commit,
push, or amend was performed.

## Health Score Delta

Balanced weighting follows the existing history: Critical = 15, Warning = 5, Suggestion = 1.

| State | Critical | Warning | Suggestion | Score |
| --- | ---: | ---: | ---: | ---: |
| Before fixes | 0 | 9 | 6 | 49 |
| After fixes / residual state | 0 | 5 | 3 | 72 |
| **Delta** |  |  |  | **+23** |

The current residual score of 72 was appended to `.brooks-lint-history.json`. It is a
sweep-local health measure, not a claim that the repository is defect-free.

## Appendix A — Exact Baseline Tracked-File Manifest

The following 409 paths are the final full-repository baseline enumeration used by the
sweep:

- `.brooks-lint-history.json`
- `.dev.vars.example`
- `.editorconfig`
- `.gitattributes`
- `.github/dependabot.yml`
- `.gitignore`
- `.mcp.json`
- `.prettierignore`
- `.prettierrc`
- `.trellis/.gitignore`
- `.trellis/.template-hashes.json`
- `.trellis/.version`
- `.trellis/agents/check.md`
- `.trellis/agents/implement.md`
- `.trellis/config.yaml`
- `.trellis/scripts/__init__.py`
- `.trellis/scripts/add_session.py`
- `.trellis/scripts/common/__init__.py`
- `.trellis/scripts/common/active_task.py`
- `.trellis/scripts/common/cli_adapter.py`
- `.trellis/scripts/common/config.py`
- `.trellis/scripts/common/developer.py`
- `.trellis/scripts/common/git.py`
- `.trellis/scripts/common/git_context.py`
- `.trellis/scripts/common/io.py`
- `.trellis/scripts/common/log.py`
- `.trellis/scripts/common/packages_context.py`
- `.trellis/scripts/common/paths.py`
- `.trellis/scripts/common/safe_commit.py`
- `.trellis/scripts/common/session_context.py`
- `.trellis/scripts/common/spec_inject.py`
- `.trellis/scripts/common/spec_match.py`
- `.trellis/scripts/common/task_context.py`
- `.trellis/scripts/common/task_queue.py`
- `.trellis/scripts/common/task_store.py`
- `.trellis/scripts/common/task_utils.py`
- `.trellis/scripts/common/tasks.py`
- `.trellis/scripts/common/trellis_config.py`
- `.trellis/scripts/common/types.py`
- `.trellis/scripts/common/workflow_phase.py`
- `.trellis/scripts/common/workflow_selection.py`
- `.trellis/scripts/get_context.py`
- `.trellis/scripts/get_developer.py`
- `.trellis/scripts/hooks/linear_sync.py`
- `.trellis/scripts/init_developer.py`
- `.trellis/scripts/task.py`
- `.trellis/spec/backend/admin-bulk-event-import.md`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/public-data-cache.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/design-system.md`
- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/type-safety.md`
- `.trellis/spec/guides/code-reuse-thinking-guide.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
- `.trellis/spec/guides/index.md`
- `.trellis/tasks/archive/2026-06/06-29-acg-event-site/check.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-acg-event-site/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-acg-event-site/prd.md`
- `.trellis/tasks/archive/2026-06/06-29-acg-event-site/task.json`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/check.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/design.md`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/implement.md`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/prd.md`
- `.trellis/tasks/archive/2026-06/06-29-admin-review/task.json`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/check.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/design.md`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/implement.md`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/prd.md`
- `.trellis/tasks/archive/2026-06/06-29-foundation-db/task.json`
- `.trellis/tasks/archive/2026-06/06-29-public-site/check.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-public-site/design.md`
- `.trellis/tasks/archive/2026-06/06-29-public-site/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-29-public-site/implement.md`
- `.trellis/tasks/archive/2026-06/06-29-public-site/prd.md`
- `.trellis/tasks/archive/2026-06/06-29-public-site/task.json`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/check.jsonl`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/design.md`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/implement.jsonl`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/implement.md`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/prd.md`
- `.trellis/tasks/archive/2026-06/06-30-bits-ui-frontend-redesign/task.json`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/check.jsonl`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/design.md`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/implement.jsonl`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/implement.md`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/prd.md`
- `.trellis/tasks/archive/2026-07/06-30-structural-frontend-redesign/task.json`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/design.md`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/implement.md`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/prd.md`
- `.trellis/tasks/archive/2026-07/07-01-bits-ui-redesign/task.json`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/design.md`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/implement.md`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/prd.md`
- `.trellis/tasks/archive/2026-07/07-15-frontend-refactor/task.json`
- `.trellis/tasks/archive/2026-07/07-16-browse-ended-events/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-browse-ended-events/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-browse-ended-events/prd.md`
- `.trellis/tasks/archive/2026-07/07-16-browse-ended-events/task.json`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/design.md`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/implement.md`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/prd.md`
- `.trellis/tasks/archive/2026-07/07-16-event-browse-metadata-theme/task.json`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/design.md`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/implement.md`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/prd.md`
- `.trellis/tasks/archive/2026-07/07-16-event-options-code-constants/task.json`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/design.md`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/implement.md`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/prd.md`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/sweep-report.md`
- `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/task.json`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/design.md`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/implement.md`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/prd.md`
- `.trellis/tasks/archive/2026-07/07-23-admin-create-event/task.json`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/design.md`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/implement.md`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/prd.md`
- `.trellis/tasks/archive/2026-07/07-26-admin-bulk-create-events/task.json`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/design.md`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/implement.md`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/prd.md`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/research/homepage-data-design.md`
- `.trellis/tasks/archive/2026-07/07-26-homepage-event-recommendations/task.json`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/design.md`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/implement.md`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-featured-event-carousel/task.json`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/design.md`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/implement.md`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/research/flowbite-technical-migration.md`
- `.trellis/tasks/archive/2026-07/07-27-flowbite-component-migration/task.json`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/design.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/implement.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/research/current-homepage-contract.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-local-discovery-streamline/task.json`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/design.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/implement.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/research/current-contract.md`
- `.trellis/tasks/archive/2026-07/07-27-homepage-nav-event-limit-required-fields/task.json`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/design.md`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/implement.md`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/research/final-validation.md`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/research/frontend-visual-audit.md`
- `.trellis/tasks/archive/2026-07/07-27-tailwind-flowbite-frontend-redesign/task.json`
- `.trellis/tasks/archive/2026-07/07-27-tongpindian-brand-copy/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-tongpindian-brand-copy/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-27-tongpindian-brand-copy/prd.md`
- `.trellis/tasks/archive/2026-07/07-27-tongpindian-brand-copy/task.json`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/design.md`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/implement.md`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/prd.md`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/research/current-homepage-location-flow.md`
- `.trellis/tasks/archive/2026-07/07-28-homepage-location-switch/task.json`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/design.md`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/implement.md`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/prd.md`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/research/codebase-scan.md`
- `.trellis/tasks/archive/2026-07/07-30-turnstile-integration/task.json`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/design.md`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/implement.md`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/prd.md`
- `.trellis/tasks/archive/2026-07/07-31-event-detail-admission-fields/task.json`
- `.trellis/tasks/archive/2026-07/07-31-hide-empty-event-details/check.jsonl`
- `.trellis/tasks/archive/2026-07/07-31-hide-empty-event-details/implement.jsonl`
- `.trellis/tasks/archive/2026-07/07-31-hide-empty-event-details/prd.md`
- `.trellis/tasks/archive/2026-07/07-31-hide-empty-event-details/task.json`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/check.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/design.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/implement.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/implement.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/prd.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/research/auto-scope-promotion.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/research/cache-api-activation.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/research/current-d1-cache-evidence.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-cache-strategy/task.json`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/check.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/design.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/implement.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/implement.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/prd.md`
- `.trellis/tasks/archive/2026-08/07-28-d1-query-write-optimization/task.json`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/check.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/design.md`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/implement.jsonl`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/implement.md`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/prd.md`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/research/global-cache-purge.md`
- `.trellis/tasks/archive/2026-08/07-28-public-dto-cache-layer/task.json`
- `.trellis/workflow.md`
- `.trellis/workspace/hobr/index.md`
- `.trellis/workspace/hobr/journal-1.md`
- `.trellis/workspace/index.md`
- `.vscode/extensions.json`
- `.vscode/launch.json`
- `.vscode/settings.json`
- `.wrangler/deploy/config.json`
- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `README.md`
- `astro.config.mjs`
- `deploy.md`
- `docs/dev/seed-public-site.sql`
- `eslint.config.js`
- `flake.lock`
- `flake.nix`
- `migrations/0001_init.sql`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `public/favicon.ico`
- `public/favicon.svg`
- `public/images/event-fallback.webp`
- `src/components/CitySelector.svelte`
- `src/components/DivisionPicker.svelte`
- `src/components/EventArtwork.astro`
- `src/components/EventCard.astro`
- `src/components/EventRow.svelte`
- `src/components/FeaturedEventCarousel.svelte`
- `src/components/FilterBar.svelte`
- `src/components/HomepageContent.svelte`
- `src/components/HomepagePopularity.svelte`
- `src/components/HomepageToday.svelte`
- `src/components/NavLocationPicker.svelte`
- `src/components/PublicMobileNav.svelte`
- `src/components/SelectField.svelte`
- `src/components/SubmissionSection.astro`
- `src/components/TagInput.svelte`
- `src/components/Turnstile.svelte`
- `src/components/admin/AdminEventForm.astro`
- `src/components/admin/AdminMobileNav.svelte`
- `src/components/admin/BulkEventImport.svelte`
- `src/components/admin/EventActions.svelte`
- `src/components/admin/EventTable.astro`
- `src/components/admin/Pagination.astro`
- `src/components/admin/TagMergeForm.svelte`
- `src/components/admin/navigation.ts`
- `src/components/ui/badge.svelte`
- `src/components/ui/button.svelte`
- `src/components/ui/card-content.svelte`
- `src/components/ui/card-description.svelte`
- `src/components/ui/card-footer.svelte`
- `src/components/ui/card-header.svelte`
- `src/components/ui/card-title.svelte`
- `src/components/ui/card.svelte`
- `src/components/ui/confirm-dialog.svelte`
- `src/components/ui/input.svelte`
- `src/components/ui/label.svelte`
- `src/components/ui/separator.svelte`
- `src/components/ui/side-panel.svelte`
- `src/components/ui/table-body.svelte`
- `src/components/ui/table-cell.svelte`
- `src/components/ui/table-head.svelte`
- `src/components/ui/table-header.svelte`
- `src/components/ui/table-row.svelte`
- `src/components/ui/table.svelte`
- `src/components/ui/textarea.svelte`
- `src/env.d.ts`
- `src/layouts/AdminLayout.astro`
- `src/layouts/Layout.astro`
- `src/lib/admin/bulk-events.ts`
- `src/lib/admin/form.ts`
- `src/lib/admin/validation.ts`
- `src/lib/auth/access.ts`
- `src/lib/auth/admin.ts`
- `src/lib/auth/token.ts`
- `src/lib/cache/cloudflare.ts`
- `src/lib/cache/invalidation.ts`
- `src/lib/cache/public-data.ts`
- `src/lib/cache/public-routes.ts`
- `src/lib/cache/purge.ts`
- `src/lib/db/admin-events.ts`
- `src/lib/db/homepage.ts`
- `src/lib/db/index.ts`
- `src/lib/db/public-events.ts`
- `src/lib/db/queries.ts`
- `src/lib/db/submissions.ts`
- `src/lib/db/tags.ts`
- `src/lib/db/views.ts`
- `src/lib/division-preference.ts`
- `src/lib/divisions.ts`
- `src/lib/events/cover.ts`
- `src/lib/events/datetime.ts`
- `src/lib/events/detail.ts`
- `src/lib/events/options.ts`
- `src/lib/events/popularity.ts`
- `src/lib/geo.ts`
- `src/lib/http/json.ts`
- `src/lib/public/form.ts`
- `src/lib/public/homepage-client.ts`
- `src/lib/public/homepage.ts`
- `src/lib/public/submission-handler.ts`
- `src/lib/runtime/env.ts`
- `src/lib/seo.ts`
- `src/lib/site.ts`
- `src/lib/turnstile.ts`
- `src/lib/utils.ts`
- `src/middleware.ts`
- `src/pages/404.astro`
- `src/pages/admin/events/[id]/edit.astro`
- `src/pages/admin/events/bulk.astro`
- `src/pages/admin/events/new.astro`
- `src/pages/admin/index.astro`
- `src/pages/admin/login.astro`
- `src/pages/admin/offline.astro`
- `src/pages/admin/published.astro`
- `src/pages/admin/tags.astro`
- `src/pages/api/admin/events/[id]/approve.ts`
- `src/pages/api/admin/events/[id]/index.ts`
- `src/pages/api/admin/events/[id]/offline.ts`
- `src/pages/api/admin/events/[id]/reject.ts`
- `src/pages/api/admin/events/[id]/republish.ts`
- `src/pages/api/admin/events/bulk/index.ts`
- `src/pages/api/admin/events/bulk/preview.ts`
- `src/pages/api/admin/events/bulk/template.ts`
- `src/pages/api/admin/events/index.ts`
- `src/pages/api/admin/tags/merge.ts`
- `src/pages/api/events/[id]/view.ts`
- `src/pages/api/homepage.ts`
- `src/pages/api/popularity.ts`
- `src/pages/api/submit.ts`
- `src/pages/api/tags.ts`
- `src/pages/events/[id].astro`
- `src/pages/events/index.astro`
- `src/pages/index.astro`
- `src/pages/sitemap.xml.ts`
- `src/pages/submit.astro`
- `src/styles/app.css`
- `src/styles/tokens.css`
- `src/types/cloudflare.ts`
- `src/worker.ts`
- `svelte.config.js`
- `test/admin-bulk-db.test.ts`
- `test/admin-bulk-events.test.ts`
- `test/admin-create-merge-db.test.ts`
- `test/admin-event-form.test.ts`
- `test/admin-mutation-db.test.ts`
- `test/admin-navigation.test.ts`
- `test/d1-query-write-optimization.test.ts`
- `test/d1-runtime-contract.test.ts`
- `test/division-preference.test.ts`
- `test/event-cover.test.ts`
- `test/event-detail-admission-fields.test.ts`
- `test/event-detail.test.ts`
- `test/fixtures/admin-bulk-events-alias.csv`
- `test/fixtures/admin-bulk-events-id-conflict.csv`
- `test/fixtures/admin-bulk-events-rollback.csv`
- `test/fixtures/admin-bulk-events-valid.csv`
- `test/helpers/sqlite-d1.ts`
- `test/homepage-discovery.test.ts`
- `test/public-data-cache-invalidation.test.ts`
- `test/public-data-cache.test.ts`
- `test/public-homepage.test.ts`
- `test/turnstile.test.ts`
- `tsconfig.json`
- `vite.config.js`
- `worker-configuration.d.ts`
- `wrangler.jsonc`
