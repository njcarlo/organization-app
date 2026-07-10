---
description: Coding standards for the HAE monorepo (React, packages, structure)
alwaysApply: true
---

# Coding standards

## Structure

- One feature app under `apps/<name>`; shared code in `packages/*`.
- Prefer importing from `@hae/ui`, `@hae/firebase`, `@hae/branding` over deep relative copies.
- Tracker sometimes uses local `AuthContext` — do not “fix” it to `@hae/ui` unless asked; keep both in sync when changing auth APIs.

## React

- Functional components; React Router v6 `Routes` / `Outlet`.
- Data: one-shot `getDocs` / `getDoc` + `useCallback` `load()` is the norm (not listeners), unless the feature already uses `onSnapshot` (e.g. feature flags).
- Filter/sort on the client after fetch unless a query is required for security rules (e.g. EiR `where('status','==','Active')` for public list).
- Reuse `Modal` from `@hae/ui` for forms/popups.
- Avoid adding `useMemo` / `useCallback` everywhere; follow existing file style.

## Naming

- Firestore fields: camelCase (`dueDate`, `bookingUrl`, `learnerEmail`).
- Person matching often uses **display name** equality (Tracker task `owner` ↔ `userProfile.name`) or **email** (LMS enrollments). Keep that convention when filtering “mine”.

## Files

- Pages: `apps/*/src/pages/`.
- App-specific components: `apps/*/src/components/`.
- Shared UI: `packages/ui/src/`.
- Do not add new markdown docs unless asked (except agent/skill files in this change set).

## Dependencies

- Do not add date/calendar libraries for simple month grids — use native `Date`.
- Do not add UI kits (MUI, Chakra, etc.).
