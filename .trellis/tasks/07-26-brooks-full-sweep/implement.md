# Full Repository Brooks Sweep Implementation Plan

## Phase 1: Planning and Activation

- [x] Capture explicit Brooks and Trellis task-creation consent.
- [x] Inspect current Trellis state, CodeGraph architecture/test maps, package scripts, prior sweep artifacts, current history, and uncommitted edits.
- [x] Converge `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, and `check.jsonl`.
- [x] Present the final planning summary and receive fresh implementation approval.
- [x] Run the Trellis planning review and activate the task with `task.py start`.

## Phase 2: Scope and Baseline

- [x] Record the 245-file consent enumeration, the 115-file deep-analysis set, protected/generated paths, and the two user-owned edits.
- [x] Confirm Brooks balanced defaults and initialize `unresolvable`, `non_critical_rounds`, dimension counts, and `fix_log`.
- [x] Run TypeScript, lint, build, and diff baselines; distinguish pre-existing failures from sweep regressions.

## Phase 3: Four Dimension Passes

- [x] Run review (R1-R6), verify each candidate against source context, classify, apply eligible fixes, and verify/roll back.
- [x] Run test (T1-T6), report the absent suite and concrete unprotected risks, and avoid creating test infrastructure automatically.
- [x] Run debt analysis with Pain x Spread scoring and avoid duplicating isolated review findings without pattern evidence.
- [x] Run architecture audit with CodeGraph/import evidence; leave public or structural remedies Residual.
- [x] Update dimension counters and `fix_log` after each attempted fix.

## Phase 4: Iteration

- [x] Re-scan modified files, same-module neighbors, and direct static consumers.
- [x] Continue Critical retries until resolved or retired after three failures.
- [x] Stop non-critical rounds after convergence or three iterations.
- [x] Aggregate all Residual, retired, and capped items without duplication.

## Phase 5: Final Verification and Report

- [x] Run final TypeScript, lint, build, and `git diff --check` gates.
- [x] Verify the original user changes remain intact and separate them from `fix_log`.
- [x] Write `sweep-report.md` with the required Full Sweep structure and trend comparison.
- [x] Append one history record while preserving existing `.brooks-lint-history.json` entries.
- [x] Inspect final status/diff and report that no commit, push, deployment, dependency, or remote-data action occurred.

## Validation Commands

```bash
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
git diff --check
```

Use `astro dev --background` only if a concrete finding needs an HTTP/runtime check. Manage it with `astro dev status`, `astro dev logs`, and `astro dev stop`. Do not add Playwright.

## Rollback Points

- Before each dimension, record its candidate list and current diff.
- On regression, reverse only that dimension's fixes with targeted patches, then rerun the relevant gate.
- Never revert the two pre-existing edits or unrelated user work.
- If an edit would require public-contract, schema, dependency, or broad architectural changes, do not attempt it; record it as Residual.
