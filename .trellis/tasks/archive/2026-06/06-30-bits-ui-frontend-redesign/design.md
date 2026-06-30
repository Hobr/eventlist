# Design

## Architecture

The redesign keeps the existing Astro/Svelte architecture:

- Astro pages continue to own server data loading and route contracts.
- Svelte islands continue to own interactive controls.
- Shared CSS files remain the visual system entry point:
    - `src/styles/tokens.css` for colors, spacing, radii, shadows, typography, and motion.
    - `src/styles/base.css` for reset and shared primitives.
    - `src/styles/public.css` for public layout and page composition.
    - `src/styles/admin.css` for admin layout and operational surfaces.

## Visual Direction

Use Bits UI's headless-component aesthetic rather than Material 3:

- Neutral, high-contrast surface tokens.
- Thin borders and crisp focus rings.
- Compact control density.
- Radius no larger than 8px for cards and repeated items.
- Clear trigger/content/item styling for `bits-ui` select controls.
- Practical dashboard-like layout for admin rather than marketing-like cards.

## Component Boundaries

- `Layout.astro` owns the public shell, navigation, and shared document metadata.
- `AdminLayout.astro` owns the admin shell and navigation.
- `EventCard.astro` owns repeated public event item presentation.
- `SelectField.svelte` remains the main Bits UI primitive wrapper.
- `DivisionPicker.svelte`, `CitySelector.svelte`, and `FilterBar.svelte` preserve current prop and URL behavior.
- Page files may be rewritten for markup structure, but data access and form names must remain stable.

## Compatibility

All existing backend and data contracts remain unchanged:

- `/events` query params: `city`, `type`, `scale`, `tag`, `from`, `to`, `sort`, `page`.
- `/submit` field names and `/api/submit` action.
- Admin login token field and auth behavior.
- Detail page JSON-LD generation.

## Risk Notes

- The largest risk is accidental route/form contract drift while replacing markup.
- `SelectField` is shared by public and admin surfaces, so its class contract must stay consistent across both CSS files.
- Existing frontend specs still mention Material 3; for this task, the task PRD is the higher-priority visual instruction.

## Rollback Shape

Rollback is limited to the frontend files touched by this task. Backend library, database, and API files should not be modified.
