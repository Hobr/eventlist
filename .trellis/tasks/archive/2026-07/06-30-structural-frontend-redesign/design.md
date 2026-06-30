# Design

## Direction

This task intentionally changes structure, not only styling.

Use the existing Bits UI-inspired visual system, but compose pages differently:

- Homepage: replace the old hero-card layout with an application-like command surface and live browse preview.
- Event list: replace the old card grid as the primary browsing mode with compact rows and a side filter rail.
- Detail page: emphasize a top event dossier with fact tiles and a sticky action/meta rail.
- Submit page: split into explicit sections inside one structured submission console, not a plain field grid.

## Boundaries

- Keep Astro server data loading inside pages.
- Keep Svelte islands for interactive form controls.
- Keep `SelectField`, `DivisionPicker`, `CitySelector`, and `FilterBar` prop contracts stable.
- CSS changes stay in `src/styles/base.css` and `src/styles/public.css`; admin may receive only necessary compatibility tweaks.

## Compatibility

Preserve these contracts:

- `/events` query params: `city`, `type`, `scale`, `tag`, `from`, `to`, `sort`, `page`.
- `/submit` field names and `/api/submit`.
- `/events/[id]` JSON-LD generation.
- Existing event records and option rows.

## Risk Notes

- The biggest risk is accidentally changing form names while reorganizing markup.
- `FilterBar.svelte` is currently a grid toolbar; turning it into a filter rail should keep the same GET form semantics.
- Card/list classes may be shared by homepage and listing pages, so keep names explicit enough to avoid layout collisions.
