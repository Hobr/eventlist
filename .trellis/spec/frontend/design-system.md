# Design System: Bits UI-Inspired Frontend

> The project's visual language for public and admin frontend work.

---

## Source of Truth

- **Component direction**: Bits UI-inspired headless component styling.
- **Implementation**: Astro pages + Svelte islands + handwritten CSS.
- **Interactive primitives**: Prefer `bits-ui` for Svelte controls that need headless behavior, such as select/listbox-style inputs. Keep wrapper components small and typed.
- **Token source**: `src/styles/tokens.css` defines the shared visual tokens. `src/styles/base.css` defines common primitives used by both public and admin surfaces.

## Token Contract

- Use semantic custom properties in `src/styles/tokens.css`:
    - colors: `--color-background`, `--color-foreground`, `--color-surface`, `--color-surface-subtle`, `--color-border`, `--color-primary`, `--color-danger`, etc.
    - shape: `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-full`.
    - motion: `--duration-fast`, `--duration-medium`, `--ease-standard`.
    - focus: `--shadow-focus`.
- Provide light and dark values through `prefers-color-scheme`.
- Do not reintroduce `--md-sys-*` tokens or Material 3 as the frontend contract unless the product direction changes again.

## Layout And Density

- Public pages should feel like a browsing tool: practical, scannable, and information-dense.
- Admin pages should feel operational: compact navigation, crisp tables, predictable controls, and no marketing-style composition.
- Use cards and repeated items at `8px` radius or less.
- Avoid nested cards; page sections should be normal layout bands or constrained content, while cards are for repeated items, forms, tables, and modals.
- Do not scale font sizes with viewport width. Use fixed `rem` sizes and breakpoint adjustments.

## Components

- `SelectField.svelte` is the shared Bits UI `Select` wrapper. Preserve its prop contract when restyling:
    - `name`, `label`, `value`, `options`, `placeholder`, `required`, `disabled`, `wide`, `onchange`.
- Bits UI select styling belongs in shared primitives:
    - `.bits-select-trigger`
    - `.bits-select-content`
    - `.bits-select-item`
    - `.bits-select-scroll-button`
- `DivisionPicker.svelte`, `CitySelector.svelte`, and `FilterBar.svelte` depend on `SelectField.svelte`; visual changes must keep URL query names and hidden form field behavior intact.
- Keep action buttons icon+text where the icon clarifies the command.

## Public Hero And Media

- Public landing heroes must use a real or bitmap activity/event image as the visual anchor. Do not use a pure CSS gradient or abstract SVG as the primary hero background.
- Hero text may overlay the image directly with a contrast layer.
- Public event cards may use a tokenized placeholder when a cover URL is missing, but real `cover_url` values should render as inspectable images.

## Accessibility

- Preserve semantic HTML for navigation, forms, tables, and details.
- Keep visible focus states via `--shadow-focus`.
- Respect `prefers-reduced-motion`.
- Ensure Chinese labels fit in controls on mobile and desktop; wrap layout before shrinking text.

## Forbidden Patterns

- Reintroducing Material 3 / `--md-sys-*` as the active visual system.
- Adding Tailwind or another CSS framework without an explicit product/tooling decision.
- Adding Playwright for validation unless the user explicitly asks for it.
- Changing form field names, route paths, or query parameter contracts as part of visual work.
- Decorative blobs, gradient-only heroes, or abstract SVGs as primary public-page media.

## Validation

- Run `corepack pnpm build`.
- Run `corepack pnpm lint`.
- For visual-only frontend work, verify the diff does not include backend data, API, or database changes unless the task explicitly requested them.
