# Design

## 1. Summary

Replace the current Flowbite Svelte + Tailwind CSS frontend with a Bits UI-first Svelte primitive layer and a thin vanilla CSS design system. Preserve every existing public and admin route, data contract and user workflow.

The migration is intentionally a single integrated task. Tailwind removal changes the rendering contract of nearly every frontend file, while public and admin surfaces share the same wrappers and style entry. Splitting them into independently started child tasks would leave an invalid mixed build boundary. Execution will instead use ordered batches with verification gates and rollback points.

## 2. Key decisions

- Bits UI `llms.txt` is the API and accessibility source of truth.
- `bits-ui@2.18.1` remains the interactive runtime.
- Add `phosphor-svelte@3.1.0` for consistent light or regular icons.
- Keep `clsx` for conditional semantic class names.
- Remove `tailwind-merge`; change `cn()` to plain `clsx` or rename it to `cx()`.
- Remove Flowbite, Tailwind and their build, formatting and icon integrations only after all consumers have migrated.
- Keep a thin central CSS layer. Do not introduce another CSS framework or styled component kit.
- Preserve no-JavaScript and SSR link behavior where it is stronger than a forced client primitive.

## 3. Architecture

### 3.1 Rendering boundaries

- Astro pages and layouts continue to own server data loading, metadata, JSON-LD, forms and route contracts.
- Svelte islands continue to own interactive state, async client requests and Bits UI primitives.
- API, database, cache and worker code remain unchanged unless a UI contract cannot be preserved without a documented correction.
- `src/components/ui/` remains the only shared primitive facade used by business components.

### 3.2 Style layers

The final style entry is `src/styles/app.css` with three responsibilities:

1. Import Geist Variable and `tokens.css`.
2. Define reset, document defaults, focus, selection, reduced motion, reveal behavior and systemic overlay layers.
3. Import `components.css`, which owns shared UI wrapper classes and Bits UI `data-*` state selectors.

`src/styles/tokens.css` owns only design tokens:

- canvas, surface, text, muted, brand, state and hairline colors.
- font families, weights and fixed responsive type steps.
- spacing, content widths and control heights.
- inner and outer radii.
- tinted shadows, focus rings and z-index layers.
- motion durations and `cubic-bezier(0.32, 0.72, 0, 1)`.

Business pages may contain a small scoped style block for route-specific grid composition. They must not redefine controls, focus, overlays, form fields or repeated card patterns.

### 3.3 Proposed visual tokens

Light mode uses warm paper and ink with one raspberry brand signal:

- canvas: `#f3f0e9`.
- surface: `#fbfaf6`.
- raised surface: `#ffffff`.
- ink: `#211c18`.
- muted ink: `#6e665f`.
- hairline: warm ink at 12 percent opacity.
- brand: `#9f3157`.
- brand foreground: `#fff8fa`.

Dark mode uses deep espresso surfaces rather than pure black:

- canvas: `#11100f`.
- surface: `#1a1816`.
- raised surface: `#24211e`.
- ink: `#f4efe8`.
- muted ink: `#bdb3aa`.
- brand: `#ec7da6`.

Warning, danger and success colors remain semantic state colors, not competing brand accents.

## 4. Primitive migration map

| Existing contract | Final implementation | Preserved behavior |
| --- | --- | --- |
| `ui/button.svelte` | Bits UI `Button.Root` | variants, sizes, anchor mode, disabled anchor blocking, forwarded attributes and active press feedback. |
| `ui/label.svelte` | Bits UI `Label.Root` | native `for` relationship and caller classes. |
| `ui/separator.svelte` | Bits UI `Separator.Root` | orientation and decorative semantics. |
| `ui/checkbox.svelte` | Bits UI `Checkbox.Root` | bindable checked state, indeterminate state, name/value forwarding and disabled state. |
| `ui/confirm-dialog.svelte` | Bits UI `AlertDialog` | trigger snippet, title, description, pending action, cancel, destructive action and focus return. |
| `ui/side-panel.svelte` | Bits UI `Dialog` | side-docked content, escape, overlay, close control, scroll lock and focus return. |
| `SelectField.svelte` | Bits UI `Select` | `name`, hidden input, required, items, disabled, bindable value and `onchange` contract. |
| `TagInput.svelte` | Bits UI `Combobox` + existing token state | suggestions, debounce, 12-tag limit, 24-char limit, hidden U+3001 delimiter serialization and draft-on-submit behavior. |
| Homepage time windows | Bits UI `Tabs` with anchor render delegation | real SSR href, arrow-key tabs, async caching, pending label and selected state. |
| Homepage mobile scene | Bits UI `ToggleGroup` | single selection, roving focus and hydrated-only visibility. |
| Mobile nav and advanced filters | Bits UI `Dialog` | accessible overlay/sheet behavior and real links inside content. |
| Tooltips | Bits UI `Tooltip` | local provider per island, icon-only action descriptions and delay defaults. |
| Input, textarea and file upload | native elements behind typed wrappers | browser validation, file picker, bindable values and forwarded attributes. |
| Alerts and tables | semantic native HTML wrappers | role/status behavior, table semantics and responsive labels. |
| Pagination | native SSR links through shared Button styles | `page`, `hasNext`, query preservation and no JavaScript requirement. |
| Featured carousel | focused custom Svelte state + shared Bits buttons | autoplay, pause on hover/focus, previous/next, slide selection and reduced motion. |

## 5. Shared component contracts

### 5.1 Class contract

- UI wrappers expose a `class` prop for one semantic extension class, not Tailwind utility strings.
- Base classes use names such as `ui-button`, `ui-field`, `ui-dialog`, `ui-select-trigger` and `ui-table`.
- Variants are expressed through data attributes such as `data-variant`, `data-size`, Bits UI state attributes and native disabled attributes.
- Business components use names that describe purpose, not presentation, for example `event-row`, `filter-summary` and `admin-action-group`.

### 5.2 Portal and layer contract

- Overlay layer tokens are fixed and documented: sticky navigation, dialog overlay, dialog content, popover/select and tooltip.
- Do not use arbitrary z-index values in components.
- Backdrop blur is limited to the sticky floating navigation and fixed overlays.
- Each overlay wrapper owns title, description, close behavior and focus restoration.

### 5.3 Motion contract

- Animate only `transform` and `opacity`.
- Use Bits UI `data-starting-style` and `data-ending-style` for entering and exiting portal content.
- Use the existing `IntersectionObserver` progressive reveal model, with content visible before enhancement.
- Do not use scroll listeners or animation libraries.
- `prefers-reduced-motion` disables transitions, autoplay and reveal offsets.

## 6. Visual composition

### 6.1 Public shell

- Use a floating sticky navigation island with brand at the left, a restrained native link group and location action at the right.
- Only the active route and primary action use strong filled treatment.
- Mobile navigation opens a full-height Dialog sheet with staggered transform/opacity entry.
- Footer remains compact and focused on the public site, GitHub, privacy and terms paths that already exist or are explicitly available.

### 6.2 Homepage

- Replace the single full-width carousel rectangle with an editorial split.
- The active featured event occupies the dominant image frame and copy block.
- Remaining featured events appear as a scan-friendly rail with real links and visible dates, not only dots.
- Preserve carousel autoplay and controls on the dominant frame.
- Present local and nationwide rankings as an asymmetric two-column comparison with different visual anchors.
- Tabs control the `3 / 7 / 30` window. ToggleGroup controls mobile scene switching.

### 6.3 Event catalogue

- Keep the result title, active conditions and result count above the list.
- Compress quick filters into a concise responsive band so the first results remain visible on common desktop viewports.
- Open advanced filters in a Dialog side sheet.
- Event rows prioritize date, title and location. Type, scale and tags become secondary.
- Preserve real links across the full row and pagination.

### 6.4 Categories

- Use an editorial taxonomy index rather than equal generic card columns.
- Preserve links to `/events?tag=...` and existing category counts.
- Use native lists and headings; no stateful primitive is required.

### 6.5 Event detail

- Use an editorial split with artwork and title on one side, and decision-critical schedule, venue and action panel on the other.
- Apply nested bezel framing only to hero artwork and the primary action panel.
- Place description and secondary facts below in an asymmetric content grid.
- Preserve JSON-LD and external link security attributes.

### 6.6 Submission

- Required groups remain visible in one form.
- Optional information remains native `details` for no-JavaScript reachability.
- Use strong section indexes and progress cues without adding a multi-step wizard.
- Inline errors remain adjacent to their fields; no toast system is added.

### 6.7 Admin

- Replace the permanent left-sidebar assumption with a compact top operational shell and contextual route navigation.
- Tables use aligned columns, tabular numbers and sticky actions only where they do not obstruct horizontal access.
- Forms share the same primitives but use tighter density tokens than public pages.
- AlertDialog owns reject, offline and destructive merge confirmation.
- Bulk import keeps all existing state transitions and uses semantic progress/status presentation.

## 7. Data and behavior compatibility

- Public and admin endpoints, methods and payload field names do not change.
- Catalogue query parameters remain `city`, `type`, `scale`, `tag`, `from`, `to`, `starts`, `active`, `sort` and `page`.
- Submission keeps POST `/api/submit`, Turnstile and `/submit?sent=1`.
- Region preference keeps `eventlist.divisionCode` and the current commit timing.
- Admin actions keep the existing POST and PATCH routes, reload behavior, reject reason and tag guards.
- Bits UI Select hidden inputs must be verified in built output for every named field.

## 8. Dependency and config migration

Remove after source migration:

- `flowbite`.
- `flowbite-svelte`.
- `flowbite-svelte-icons`.
- `tailwindcss`.
- `@tailwindcss/vite`.
- `@tailwindcss/forms`.
- `prettier-plugin-tailwindcss`.
- `tailwind-merge`.

Update or remove:

- Tailwind plugin entries in `astro.config.mjs` and `vite.config.js`.
- Tailwind plugin and stylesheet options in `.prettierrc`.
- `@import "tailwindcss"`, Flowbite plugin and Flowbite source declarations in `src/styles/app.css`.
- `src/lib/utils.ts` class merge implementation.
- Flowbite-specific test assertions in `test/flowbite-component-coverage.test.ts`.

Add:

- `phosphor-svelte@3.1.0`.
- `src/styles/components.css`.
- Bits UI component coverage tests based on primitive imports, preserved contracts and banned dependency checks.

## 9. Validation strategy

### 9.1 Automated

- `corepack pnpm build`.
- `corepack pnpm lint`.
- `corepack pnpm test`.
- Source scans for removed dependencies and Tailwind variant syntax.
- Contract tests for Bits UI wrappers, named hidden select inputs, SSR links and approved native boundaries.

### 9.2 Runtime

- Start with `./node_modules/.bin/astro dev --background` because the package-manager wrapper did not retain the daemon in this environment.
- Check public routes through HTTP and browser navigation.
- Check admin login and expected protected-route behavior.
- Read `astro dev logs` and browser console errors.
- Verify no repeated `lifecycle_outside_component` error.

### 9.3 Visual

- Desktop and 390px mobile checks for homepage, catalogue, detail, categories, submit, 404 and admin login.
- Authenticated admin checks when local auth context permits.
- Verify light and dark system preference, keyboard focus and reduced motion.
- Do not add Playwright to the repository.

## 10. Risks and rollback

| Risk | Mitigation |
| --- | --- |
| Removing Tailwind breaks every existing class string at once. | Keep the old stack during early batches. Remove it only after all source consumers use semantic classes. |
| Bits Select changes form submission. | Preserve wrapper props and test hidden inputs, required behavior and built form payload names. |
| Astro islands cannot share one provider. | Keep providers local to each island and portal to `body`. |
| Flowbite carousel removal regresses autoplay or focus pause. | Preserve current state machine and add focused source-contract tests before removing Flowbite. |
| Visual scope causes behavior drift. | Treat route, form and API contracts in `prd.md` as hard gates for every batch. |
| Existing tests enforce the old framework. | Rewrite them to assert Bits UI and behavior in the same batch as primitive migration. |
| Broad diff is hard to review. | Use ordered gates and review each batch diff before proceeding. |

Rollback is a single task commit or an ordered set of task commits. No database or API migration is involved. Existing `.mcp.json` and `.vscode/*` changes remain untouched.
