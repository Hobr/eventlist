# Implementation Plan

## Checklist

1. Load current frontend specs and source context.
2. Rewrite design tokens from Material 3 to a Bits UI-inspired system.
3. Rebuild shared base primitives for controls, buttons, cards, chips, notices, focus, and responsive behavior.
4. Rework public shell and pages:
    - `Layout.astro`
    - `index.astro`
    - `events/index.astro`
    - `events/[id].astro`
    - `submit.astro`
    - `EventCard.astro`
5. Rework Svelte interactive controls without changing prop contracts:
    - `SelectField.svelte`
    - `FilterBar.svelte`
    - `DivisionPicker.svelte`
    - `CitySelector.svelte`
    - `TagInput.svelte` if needed for visual consistency.
6. Rework admin shell and CSS while preserving admin pages and forms.
7. Run `corepack pnpm build`.
8. Run `corepack pnpm lint` and fix task-related issues.
9. Do a final diff review for unintended backend/API changes.

## Validation Commands

```bash
corepack pnpm build
corepack pnpm lint
```

## Guardrails

- Do not add Playwright.
- Do not introduce Tailwind or another styling framework.
- Do not change backend data contracts.
- Do not change form field names or query parameter names.
- Keep implementation in small enough edits that rollback is obvious.
