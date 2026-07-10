---
name: add-app-page
description: Add a new page to an HAE app (Tracker, LMS, EiR, CRM, AMS) with route, nav, and existing shell patterns. Use when adding a screen, menu item, or module page.
---

# Add an app page

## Checklist

1. Identify the app under `apps/<app>/`.
2. Create `src/pages/YourPage.jsx` matching neighboring page chrome (header, loading line, filters).
3. Wire route in `src/App.jsx`:
   - Tracker: under `Layout` + correct `ProtectedRoute` / feature gate.
   - LMS/CRM/AMS: under `ModuleShell`.
   - EiR: **public** pages under `PublicShell`; member pages under `/app` + `ModuleShell`.
4. Add sidenav item (Tracker `Sidebar.jsx` or `navItems` / `eirNav` / module nav) with an existing `navIcons` icon.
5. Reuse data patterns: `getDocs` + client filter; owner/email matching like siblings.
6. Optional: help blurb in `packages/ui/src/helpContent.js`.
7. Build the workspace and smoke the route locally.

## Avoid

- New global state libraries.
- Duplicate Firebase init (use `@hae/firebase` or app `firebase.js` re-export).
- Putting member-only tools on the public EiR shell.
