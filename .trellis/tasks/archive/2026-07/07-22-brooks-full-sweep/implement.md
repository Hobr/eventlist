# Full Brooks quality sweep implementation plan

## Phase 1: Planning Gate

- [x] Create this Trellis task after user consent.
- [x] Inspect repository structure, package scripts, specs, active task context, and historical sweep context.
- [x] Write and converge `prd.md`, `design.md`, and this execution plan.
- [x] Present the completed artifacts and the exact Brooks Step 0 pre-flight notice; wait for implementation/sweep consent.
- [x] Run `python3 ./.trellis/scripts/task.py start` only after the user approves the planning artifacts.

## Phase 2: Baseline And Configuration

- [x] Enumerate the final tracked-file scope and classify protected/generated paths (233 tracked; 110 non-Trellis analyzed; 123 Trellis files protected).
- [x] Read and validate `.brooks-lint.yaml`; it is absent, so default `balanced` settings apply.
- [x] Run the baseline and post-fix gates with `corepack pnpm`: TypeScript, Prettier, lint, build, and `git diff --check`.
- [x] Record the absence of a test script/test suite and preserve the known TypeScript 7 parser and Wrangler read-only-log limitations.
- [x] Validate a fresh local D1 baseline: one migration, four application tables, and no forbidden dimension tables.

## Phase 3: Dimension Passes

- [x] Run review (R1-R6), classify each finding, apply only Safe/Extended-Safe fixes, and verify or revert.
- [x] Run test (T1-T6), including coverage-illusion evidence for untested active code; do not create test infrastructure as an automatic fix.
- [x] Run debt analysis, score pain × spread, and avoid duplicating isolated review findings without accumulation evidence.
- [x] Run architecture audit, map dependency direction, and leave module-boundary/public-contract changes as Residual unless trivially safe.
- [x] Update dimension counters and `fix_log` after every attempted fix.

## Phase 4: Iteration And Convergence

- [x] Re-scan modified files, their same-module neighbors, and direct static consumers.
- [x] Retry Critical findings until fixed or retired after three failed attempts.
- [x] Stop non-critical iteration after a clean round; no iteration-cap residuals were produced.
- [x] Ensure no finding is silently dropped, duplicated, or re-queued after retirement.

## Phase 5: Final Verification And Report

- [x] Re-run final TypeScript, Prettier, lint, build, and diff checks; no tracked generated-config drift was introduced.
- [x] Assemble the Full Sweep report with scope, config, dimension table, iteration history, fix log, health delta, residuals, and summary in `sweep-report.md`.
- [x] Append the first report score record to `.brooks-lint-history.json`.
- [x] Review whether any reusable project convention was discovered; no code-spec update was needed because the fix was formatting-only and existing specs already cover the residual contracts.
- [x] Do not deploy, push, amend, or commit as part of the Brooks pipeline. Leave the final repository state and validation evidence explicit for handoff.

## Validation Commands

```bash
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
git diff --check
```

Use `astro dev --background` only for a targeted runtime check required by a finding, manage it with `astro dev status/logs/stop`, and do not add Playwright. Any temporary D1 or build persistence must live under a temporary directory and be cleaned up without touching remote data.

## Rollback Points

- Before each dimension: record the clean baseline and the list of fixes from earlier dimensions.
- After a failing gate: revert only the current dimension's changes in reverse order, then re-run the gate.
- After a failed iteration: retire the finding rather than broadening the edit or changing public contracts.
- Before handoff: inspect `git status`, `git diff --check`, and tracked config files for unintended drift; never use `git reset --hard` or `git checkout --`.
