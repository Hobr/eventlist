# Frontend Design System

This document is the implementation contract for Eventlist public and admin UI work.

## Source of truth

- Astro pages own server data loading, metadata, JSON-LD, route contracts, and native forms.
- Svelte 5 islands own client state, async interaction, and Bits UI primitives.
- `bits-ui` is the interactive primitive library. Use its installed types and official documentation as the API reference.
- `src/components/ui/` is the only shared primitive facade used by business components.
- `src/styles/app.css` is the style entry. It imports `tokens.css` and `components.css`.
- `src/styles/tokens.css` owns visual tokens. `src/styles/components.css` owns reusable semantic classes and primitive state selectors.
- `phosphor-svelte` supplies interface icons. Import each icon from `phosphor-svelte/lib/*` and keep the matching modules in `astro.config.mjs` `optimizeDeps.exclude`. Without that exclusion, Vite can optimize a deep Svelte icon module and run its top-level `getIconContext()` outside component initialization. Decorative icons use `aria-hidden="true"`.
- `src/lib/utils.ts` exports `cn()` as a thin `clsx` wrapper. It does not merge utility classes.

Do not add Flowbite, Tailwind, another utility-first framework, or another component runtime.

## Visual direction

- Public pages use a warm editorial system with restrained raspberry brand emphasis, clear hierarchy, real event media, and asymmetric composition where it improves scanning.
- Admin pages use the same tokens with tighter operational density, compact navigation, aligned tables, and explicit status states.
- Geist Variable is the primary self-hosted font. Keep the Chinese system fallback stack from `tokens.css`.
- Cards are reserved for repeated items, dialogs, and genuinely framed tools. Page sections stay unframed.
- Avoid decorative gradients, floating blobs, oversized marketing type inside tools, excessive pills, and nested cards.
- Repeated fixed-format elements must have stable dimensions and responsive constraints.

## Styling contract

- Components use semantic class names such as `ui-button`, `event-row`, and `admin-form-section`.
- Do not add presentation utility strings or breakpoint and state variants in markup.
- Prefer data attributes for variants and state, including `data-variant`, `data-size`, and Bits UI state attributes.
- UI wrappers accept a `class` prop for a semantic extension class. Wrapper layout hooks may use a separately named prop when the outer wrapper owns the layout.
- Colors, spacing, radius, shadows, focus, motion, and layer values come from `tokens.css`.
- Business components must not redefine shared controls, overlays, forms, or table primitives in local style blocks.
- Animate only `transform` and `opacity`. Use `--ease-standard` and project duration tokens.
- Honor `prefers-reduced-motion`. Content remains visible before progressive enhancement.
- Full-height surfaces use `100dvh`, not `100vh`.

## Primitive boundaries

Use Bits UI for interaction behavior:

- `Button.Root` for shared button and anchor commands.
- `Label.Root` and `Separator.Root` for accessible shared primitives.
- `Checkbox.Root` for hydrated checkbox state and named form participation.
- `Dialog` for side panels and mobile navigation.
- `AlertDialog` for destructive confirmation.
- `Select` for shared named single-select fields.
- `Combobox` for canonical tag suggestions.
- `Tabs` for homepage popularity windows.
- `ToggleGroup` for the hydrated mobile popularity scene switch.

Use native HTML when it provides the stronger contract:

- `form`, `nav`, `main`, `section`, `article`, `table`, and real links remain semantic HTML.
- Inputs, textareas, and file upload controls stay native behind typed wrappers.
- Public optional submission groups use native `details` for no-JavaScript reachability.
- Hidden inputs carry composed form values and Turnstile responses.
- Public and admin pagination use real SSR links through the shared Button wrapper.
- The admin event table remains a native table inside an overflow boundary.
- The new-event page may create native duplicate-warning checkboxes in its non-hydrated DOM script so browser `required` validation remains authoritative.
- The featured carousel may use a native button for its custom slide rail because the component owns the complete carousel state contract.

Do not implement a second dialog, select, combobox, or hydrated checkbox behavior outside these shared owners.

## Shared component contracts

### Button

- Preserve anchor and button modes, forwarded attributes, disabled anchor blocking, and focus behavior.
- Variants are `default`, `outline`, `ghost`, `destructive`, and `tonal`.
- Sizes are `sm`, `md`, `lg`, and `icon`.
- Icon-only buttons require an accessible label.

### SelectField

- Preserve `name`, `label`, `value`, `options`, `placeholder`, `required`, `showRequiredIndicator`, `disabled`, `wide`, and `onchange`.
- Pass `name`, `items`, and `required` to `Select.Root` so Bits UI creates named form participation.
- Keep real option labels, keyboard navigation, and typeahead.

### DivisionPicker

- Preserve `province`, `city`, and `county` composition plus the hidden `division_code` field.
- Keep municipality auto-selection and the existing `onchange` value contract.
- `showRequiredIndicator` marks the composed field once.

### TagInput

- Preserve `name="tags"`, the `U+3001` delimiter, the 12 tag limit, the 24 character limit, draft-on-submit serialization, suggestion debounce, and canonical options.
- The hidden field remains the form value; the Combobox owns suggestion interaction.

### Overlays

- Shared wrappers own portals, titles, descriptions, escape close, outside interaction, scroll locking, and focus restoration.
- Use the fixed layer tokens for navigation, overlay, dialog, popover, and tooltip surfaces.
- Do not add arbitrary z-index values in component markup.

## Behavior contracts

### Public site

- Preserve homepage location switching, featured carousel behavior, local and nationwide rankings, `3`, `7`, and `30` day windows, cache states, and loading, error, and empty states.
- Preserve catalogue query keys: `city`, `type`, `scale`, `tag`, `from`, `to`, `starts`, `active`, `status`, `sort`, and `page`.
- Preserve detail metadata, JSON-LD, external source and ticket links, and return navigation.
- Preserve submission field names, native validation, Turnstile, POST `/api/submit`, and redirect `/submit?sent=1`.
- Write `eventlist.divisionCode` only at the existing successful commit point.

### Admin

- Preserve authentication mode handling and the validated `next` redirect.
- Preserve create, CSV preview and import, edit, approve, reject, offline, republish, and tag merge endpoints and payloads.
- Reject and offline actions use AlertDialog confirmation.
- Pending, disabled, inline error, focus restoration, and screen-reader status states are required.
- Approve and republish remain disabled until at least one canonical tag exists.
- Bulk import must preserve client parsing, server preview, warning confirmation, submit-time validation, created-event links, and result focus.

## Accessibility and responsive rules

- Every interactive control needs a visible focus state, accessible name, and correct title and description relationship.
- Mobile layout below 768px uses a single column or an explicit internal horizontal overflow boundary.
- Page-level horizontal overflow, overlapping controls, and unreachable actions are defects.
- Touch targets remain stable while icons, labels, pending text, and validation messages change.
- Portal content must remain reachable by keyboard and restore focus when closed.
- System light and dark modes use token overrides. Do not add a class-based theme toggle without a dedicated requirement.

## Verification

Before completing frontend changes, run:

```bash
corepack pnpm format
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

For route or interaction changes, start the background Astro server and smoke-check the affected public and admin routes at desktop and mobile widths. Check reduced motion and system dark mode when presentation changes. Do not add Playwright to this repository.
