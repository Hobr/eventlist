# Implementation Plan

## Checklist

1. Read task artifacts and frontend design-system spec.
2. Inspect current public pages after the previous redesign.
3. Add/replace structural CSS for:
    - command-style homepage
    - event browse workspace
    - compact event rows
    - event detail dossier
    - sectioned submit console
4. Update public page markup:
    - `src/pages/index.astro`
    - `src/pages/events/index.astro`
    - `src/pages/events/[id].astro`
    - `src/pages/submit.astro`
    - `src/components/EventCard.astro`
    - `src/components/FilterBar.svelte`
5. Preserve all route/query/form contracts.
6. Run `corepack pnpm lint`.
7. Run `corepack pnpm build`.
8. Review diff to ensure no backend/API/database files changed.

## Validation Commands

```bash
corepack pnpm lint
corepack pnpm build
```

## Commit Notes

Commit only the current structural redesign files and this task's Trellis files. Do not include unrelated Trellis workspace formatting changes from prior session bookkeeping unless finish-work scripts require their own auto-commit.
