# Bits UI official documentation notes

## Sources

- Official source: `https://bits-ui.com/docs/llms.txt`
- Retrieved: 2026-08-06
- Installed and latest npm version: `bits-ui@2.18.1`
- Installed peer contract: Svelte `^5.33.0`, project uses Svelte `5.56.8`

## Confirmed styling model

- Bits UI is a headless Svelte component library.
- Most components ship with almost zero styles.
- Supported styling mechanisms are `class`, `style`, component `data-*` attributes, global classes and scoped styles through `child` snippets.
- This task will use global semantic classes and Bits UI `data-*` selectors. Inline style props are not part of the project contract.
- Component state animation should use documented attributes such as `data-state`, `data-starting-style` and `data-ending-style`.

## Relevant primitives

| Product need | Bits UI primitive | Notes |
| --- | --- | --- |
| Button and anchor actions | `Button.Root` | Supports `href`, `disabled`, native button attributes and `data-button-root`. |
| Destructive confirmation | `AlertDialog` | Provides portal, overlay, focus trap, title, description, cancel and action. |
| Mobile navigation and filter sheet | `Dialog` | Content can be positioned as a side sheet while preserving dialog behavior. |
| Business selects | `Select` | `name` renders a hidden form input. `required` requires `name`. `items` supports typeahead and autofill. |
| Checkbox controls | `Checkbox.Root` | Supports checked and indeterminate states with accessible keyboard behavior. |
| Labels and separators | `Label.Root`, `Separator.Root` | Replace Flowbite wrappers where the primitive adds semantics. |
| Popularity windows | `Tabs` | Use render delegation so each trigger can keep an SSR `href`. |
| Single scene choice | `ToggleGroup` | Use `type="single"` and roving focus. |
| Tag suggestions | `Combobox` | Preserve the existing tag token model and hidden serialized input. |
| Icon-only action help | `Tooltip` | A provider is required within each Svelte island that owns tooltips. |
| Bulk import state | `Progress` or `Meter` | Use only when a meaningful determinate value exists. |

## Intentional native boundaries

- Semantic page structure remains native Astro HTML.
- Input, textarea, file input and table stay native because Bits UI has no equivalent primitive and the browser behavior is valuable.
- Public and admin pagination keeps real SSR links. Bits UI Pagination requires a total item count and renders button triggers, while current routes expose only `page` and `hasNext`.
- Optional public submission fields remain native `details` to keep no-JavaScript access.
- The featured event carousel keeps focused custom Svelte state because Bits UI has no carousel primitive. Its controls use the shared Bits UI Button wrapper.

## Icon choice

- Bits UI official examples use direct imports from `phosphor-svelte/lib/*`. In this Astro setup, those imports must be listed in `astro.config.mjs` `optimizeDeps.exclude`; otherwise Vite may dependency-optimize an icon module and run its top-level `getIconContext()` outside Svelte component initialization.
- `phosphor-svelte@3.1.0` supports Svelte 5 and Vite 5+.
- The migration uses per-icon `phosphor-svelte/lib/*` imports with the shared optimizer exclusion list so production and development use the same module boundary.

## Implementation cautions

- Astro pages contain multiple independent Svelte islands. A single Svelte `BitsConfig` cannot wrap the full Astro document context.
- Use local `BitsConfig` only inside complex islands that benefit from shared locale or portal defaults.
- Portal content defaults to `body`; wrappers must own layer tokens and focus restoration.
- Official examples use Tailwind class strings, but the user explicitly rejected Tailwind. Only the primitive structure, props, data attributes and accessibility behavior are normative for this task.
