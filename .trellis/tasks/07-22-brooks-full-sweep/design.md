# Full Brooks quality sweep design

## Architecture And Boundaries

The repository is a single Astro application deployed through the Cloudflare adapter.
The sweep treats these as the meaningful ownership boundaries:

1. `src/pages/**` and `src/middleware.ts`: route adapters, request parsing, response envelopes, and authentication entrypoints.
2. `src/components/**` and `src/layouts/**`: Astro/Svelte presentation and Bits UI wrappers. `src/components/ui/**` is the reusable primitive boundary.
3. `src/lib/**`: shared policy and domain helpers, split into `db`, `auth`, `events`, `public`, `admin`, `runtime`, `http`, and `seo` concerns.
4. `migrations/**` and `docs/dev/**`: D1 schema and development data contracts.
5. Root configuration (`package.json`, TypeScript, Astro, Vite, ESLint, Wrangler, Svelte, Nix): composition and tooling boundaries.

`src/lib/db/queries.ts` is the persistence gateway. Pages and components may consume typed query results, but domain or UI code must not gain direct infrastructure access as an automatic cleanup. `src/lib/events/options.ts`, `src/lib/divisions.ts`, and `src/lib/events/datetime.ts` are shared policy modules; changes to their exported contracts are Residual unless a proven local repair preserves every caller.

## Scan And Classification Model

The four passes use the Brooks risk definitions R1-R6 and T1-T6:

- Review scans production code for cognitive overload, change propagation, duplication, accidental complexity, dependency direction, and domain-language distortion.
- Test scans discovered test files and actively modified production paths for obscurity, brittleness, duplication, mock abuse, coverage illusion, and architecture mismatch. The absence of a test runner is evidence to report, not a reason to invent one.
- Debt re-groups repeated findings across modules and scores pain × spread. A local readability issue must not be escalated without evidence of accumulation or blast radius.
- Audit checks dependency direction, layering, infrastructure leakage, cycles, missing seams, and god modules. Architecture changes are normally Residual.

Each finding stores its risk code, file and approximate lines, Iron Law fields, severity, fix class, verification command, attempt count, and outcome. Generated declarations, binary assets, and Trellis metadata can be enumerated but are not targets for speculative edits.

## Safe Fix Policy

The implementation may apply only changes that are mechanically local and behavior-preserving, such as removing unreachable local code, naming a local constant, adding a leaf guard whose failure path is already specified, or extracting a non-exported helper with unchanged inputs/outputs. A fix that changes a route, exported type, database contract, form field, URL parameter, auth boundary, or public visual/data behavior is not Safe merely because it fits in one file.

Extended-Safe fixes require a passing pre-fix baseline, no public signature change, no more than five files, and a focused post-fix verification. Because the current package has no test script and no tracked unit-test suite, behavior-changing multi-file fixes will generally remain Residual even when lint and build pass.

## Verification And Rollback

The baseline and each dimension use:

```text
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
git diff --check
```

`lint` may expose the documented TypeScript 7 / ESLint parser compatibility issue. Prettier, TypeScript, and the production build remain useful gates; dependency downgrades and application workarounds are prohibited. A build may touch ignored `.astro`, `.wrangler`, or temporary output; tracked configuration drift is checked and restored before reporting.

If a dimension fails after a fix, revert only that dimension's fixes in reverse order, rerunning the relevant gate after each revert. No destructive Git reset or checkout is permitted. The pipeline never commits, pushes, or amends.

## Protected Context

The already-created `07-16-event-browse-metadata-theme` task and its artifacts are historical context, not sweep output. The new task's own planning files are also protected from Brooks code edits. Any issue found in those documents is reported separately only if it affects execution safety; it is not silently rewritten during the code sweep.

## Report State

The final report is assembled from a persistent in-session state:

- `unresolvable`: `(file, line range, risk, signature)` entries retired after three failed attempts.
- `non_critical_rounds`: count of mixed or non-critical re-scan rounds, capped at three.
- `fix_log`: every applied, reverted, or retired fix with reason and verification result.
- dimension counters: scanned, Safe applied, Extended-Safe applied, reverted, and Residual.

The report language follows the user's Chinese request while retaining the required English structural labels and book/principle names.
