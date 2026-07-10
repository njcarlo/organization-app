---
description: HAE visual and UI conventions for frontend work
globs: apps/**/*.{jsx,tsx,css},packages/ui/**/*.{jsx,tsx,css},packages/branding/**/*
---

# HAE UI conventions

## Brand

- Colors/fonts from `@hae/branding` — crimson `#b80028`, ink, slate, mist, line.
- Font: Inter via branding stylesheet; use `font-display` for titles.
- Avoid generic AI aesthetics: purple gradients, glow, cream+terracotta newspaper layouts, emoji decoration.

## Layout patterns

- Authenticated apps: `ModuleShell` (LMS/CRM/AMS/EiR `/app`) or Tracker `Layout` + `Sidebar`.
- Public EiR: `PublicShell` only — no platform header login wall on `/`, `/directory`, `/experts/:id`.
- Page header: `font-display text-3xl` title + short `text-sm text-hae-slate` subtitle.
- Tables: `hae-table-scroll` + `border-hae-line`; mobile often uses cards + `TaskDetailPopup` / `Modal`.

## Components

- Primary actions: `hae-btn` or `bg-hae-crimson … text-white uppercase text-xs font-semibold`.
- Secondary: `hae-btn-secondary` or `border border-hae-line`.
- Prefer existing icons in `packages/ui/src/navIcons.jsx` (`calendar`, `users`, etc.).

## Landing / marketing surfaces

- One clear composition in the first viewport; brand-forward.
- Full-bleed or edge-to-edge hero atmosphere (gradients/patterns OK); avoid card-soup heroes.
- Cards only when they contain interaction (directory tiles, forms).

## Help copy

- User-facing how-tos go in `packages/ui/src/helpContent.js` for the relevant module.
