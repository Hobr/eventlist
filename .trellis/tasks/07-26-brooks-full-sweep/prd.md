# Full Repository Brooks Sweep

## Goal

Run a complete Brooks-Lint sweep over the current `eventlist` repository. Diagnose code decay, test quality, accumulated debt, and architecture integrity; automatically apply only verifiable low-risk fixes; and leave an evidence-backed report for every residual risk.

## Background

- The user approved the exact Brooks Step 0 pre-flight notice for approximately 245 tracked files.
- The repository is an Astro SSR application using the Cloudflare adapter, Svelte 5, Bits UI, Tailwind CSS, and D1. Production code is concentrated in `src/`, with schema and seed contracts in `migrations/` and `docs/dev/`.
- The July 22 sweep is archived at `.trellis/tasks/archive/2026-07/07-22-brooks-full-sweep/`. Since that sweep, the repository added the admin event-creation workflow and upgraded project/Trellis dependencies, so prior findings are context rather than current conclusions.
- `package.json` exposes `lint` and `build`, but no test script; no tracked test files are currently discoverable. The test pass must report this gap rather than treating absent tests as passing.
- No `.brooks-lint.yaml` exists, so all R1-R6 and T1-T6 risks use balanced severity and the default three-round non-critical cap.
- The worktree already contains user-owned edits to `.brooks-lint-history.json` and `src/pages/api/admin/tags/merge.ts`. They must be preserved and distinguished from sweep fixes.

## Scope

- Enumerate all 245 files tracked when consent was given.
- Deeply analyze the 115 non-`.trellis` tracked files where the risk definitions apply, prioritizing `src/`, migrations, seed data, build/deploy configuration, and repository documentation.
- Use the 130 tracked `.trellis/**` files as project context. Do not automatically refactor Trellis runtime, history, archived tasks, journals, generated declarations, lockfiles, or binary media unless a verified sweep fix directly requires a generated or dependency artifact to change.
- Re-scan every modified file, its same-module neighbors, and its direct static consumers.

## Requirements

### R1: Diagnose before fixing

Run `brooks-review -> brooks-test -> brooks-debt -> brooks-audit` in that order. Every finding must include `Symptom / Source / Consequence / Remedy`, severity, concrete file evidence, and a fix class.

### R2: Enforce the automatic-fix boundary

- Apply `Safe` fixes only when they are single-file, local, behavior-preserving, and do not alter an exported contract.
- Apply `Extended-Safe` fixes only when the pre-fix verification baseline passes, no public signature changes, and no more than five files are touched by that finding.
- Leave public API changes, cross-module structural work, behavior changes without tests, and ambiguous remedies as `Residual`.

### R3: Verify and roll back each dimension

Establish and record a pre-fix baseline using `corepack pnpm exec tsc --noEmit`, `corepack pnpm lint`, `corepack pnpm build`, and `git diff --check`. After each pass, rerun the relevant gates. If a new failure appears, undo only that pass's fixes in reverse order using targeted patches, then promote the finding to Residual.

### R4: Preserve project and user contracts

Do not change routes, request/response envelopes, form fields, URL parameters, D1 invariants, auth/Turnstile behavior, Astro/Svelte/Bits UI choices, or accepted input semantics merely to improve a quality score. Do not overwrite the two pre-existing worktree edits.

### R5: Iterate within limits

Critical findings continue until resolved or retired after three failed verification attempts. Warning/Suggestion rounds stop after a clean round or three non-critical iterations. Retired and capped findings remain visible in the final report.

### R6: Produce an auditable outcome

Write `sweep-report.md` with scope, configuration, four dimension summaries, iteration history, fix log, residuals, unresolvable items, health-score estimate/delta, trend, and verification results. Append one new Full Sweep history record without removing or rewriting existing records.

## Acceptance Criteria

- [ ] AC1: The approved pre-flight scope, current task, 245-file enumeration, protected paths, missing Brooks config, and two pre-existing edits are recorded before product-code changes.
- [ ] AC2: Baseline TypeScript, lint, build, and diff checks are run and their pre-existing failures, if any, are separated from sweep regressions.
- [ ] AC3: Review, test, debt, and audit passes complete in the required order; every finding follows the Iron Law and has a fix class.
- [ ] AC4: Only Safe or Extended-Safe changes are applied, each is verified, and any regression is reverted without disturbing user changes.
- [ ] AC5: The iteration policy is followed, with no silent drops or retries beyond the defined budgets.
- [ ] AC6: The final report contains dimension counts, fix outcomes, residual reasons, health score delta/trend, and exact validation summaries.
- [ ] AC7: No test success is claimed when no suite exists; test infrastructure, Playwright, deployments, remote D1 commands, dependency changes, and public-contract refactors are not introduced automatically.
- [ ] AC8: The sweep does not commit, amend, push, or deploy, matching the consent notice.

## Out of Scope

- New product features, UI redesign, schema evolution, migration-history rewrites, or dependency upgrades.
- Adding a test runner, complete test infrastructure, E2E tooling, or Playwright as an automatic fix.
- Automatic package/module moves, exported-symbol renames, route/API contract changes, or cross-boundary transaction redesign.
- Rewriting Trellis runtime/history, archived tasks, journals, generated worker declarations, binary assets, or lockfiles for style-only reasons.

## Open Questions

None. The user's approved Brooks policy resolves scope and risk tolerance; implementation only awaits approval of these final planning artifacts.
