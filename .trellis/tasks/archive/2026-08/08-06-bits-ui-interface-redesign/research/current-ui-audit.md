# Current UI audit

## Evidence collected

- CodeGraph exploration of public and admin routes, shared components and caller blast radius.
- Dependency and import scan across Astro, Svelte, styles and config.
- Browser audit of the current homepage and activity catalogue.
- DOM audit of homepage, submission and admin login flows.
- Baseline commands on 2026-08-06:
    - `corepack pnpm build`: pass.
    - `corepack pnpm lint`: pass.
    - `corepack pnpm test`: pass, 169 tests.

## Strengths to preserve

- Public navigation, skip link and active-route labeling are clear.
- Homepage carousel and popularity controls expose useful ARIA labels and real event links.
- Catalogue filters preserve URL state and show event metadata without opening detail pages.
- Submission required fields remain visible and optional fields are progressively disclosed.
- Admin actions already expose pending, error, disabled and destructive-confirmation states.
- Light and dark system preference, focus state and reduced-motion foundations already exist.

## Visual and interaction weaknesses

### Shared shell

- The floating navigation uses pills for nearly every element, so active state, location and ordinary links compete at the same visual weight.
- Large pale surfaces and generic card framing make unrelated pages feel mechanically identical.
- Flowbite defaults and Tailwind overrides are coupled through important dark variants, which makes special-case colors fragile.

### Homepage

- The hero is visually dominant but exposes alternative featured events mainly through dots, so the content set is hard to scan.
- The page moves from one large rectangle to another without a distinctive editorial rhythm.
- Local and nationwide rankings use almost identical presentation, reducing comparison clarity.
- Time window and scene controls add two stacked segmented controls before the results.

### Event catalogue

- The filter form consumes most of the first viewport before users see results.
- Every field, label and row uses similar contrast, so primary scan targets are not obvious.
- Repeated badges and metadata create noise without clearly prioritizing date, location and event type.
- Advanced filters look like another full-width button instead of a secondary disclosure surface.

### Detail and submission

- Detail data is complete but the page needs a stronger split between decision-critical information and secondary facts.
- The submission form has good semantic grouping, but long uniform sections need stronger progress and hierarchy cues.
- The current design language relies on utility classes in every page, making visual consistency expensive to maintain.

### Admin

- Public marketing-like card treatment leaks into operational workflows.
- Dense actions, tables and forms need clearer hierarchy and more predictable alignment than the public shell.
- The current component-coverage test is tied to Flowbite implementation details instead of product behavior and accessibility contracts.

## Runtime observation

- The background dev server served public pages successfully.
- One dev log recorded a Svelte `lifecycle_outside_component` exception during initial browser loading, despite successful HTTP responses and a green production build.
- Final validation should require clean route loads and no repeated lifecycle exception in `astro dev logs` or browser console output.
