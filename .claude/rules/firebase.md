---
description: Firebase Auth, Firestore, hosting, and rules conventions
globs: firestore.rules,firebase.json,packages/firebase/**/*,functions/**/*,**/firebase.js
---

# Firebase conventions

## Project

- Project ID: `hae-operating-tracker`
- Client config: `packages/firebase/src/index.js` (shared `auth`, `db`, `functions` region `us-east1`, `secondaryAuth` for admin user-create)

## Auth

- Email/password; shared `LoginPage` / `AuthActionPage` from `@hae/ui`.
- Password-reset custom handler: `/auth/action` (empty `apiKey` workaround).
- Superadmins: `packages/ui/src/superadmin.js`.
- Admin user create uses `secondaryAuth` so the admin session is not replaced.
- Bulk invite: `provisionAuthUsers` callable (Admin SDK) with client `secondaryAuth` fallback — Admin → Users.

## Firestore

- Update **`firestore.rules` in the same PR** as new collections or public reads.
- Public reads must be intentional and narrow (e.g. Active `experts` only).
- Queries must match rules (public EiR directory uses `where('status','==','Active')`).
- Do not expose emails on public UI even if the field exists on the document.

## Hosting

- Multi-site targets in `firebase.json` / `.firebaserc` (`tracker`, `lms`, `eir`, `crm`, `ams`, `hub` + legacy).
- SPA rewrites to `index.html`; `/__/` auth paths are Firebase-reserved.

## Deploy

- Default: hosting + Firestore rules (Spark OK).
- Functions: Blaze only (`npm run deploy:functions`). Never let a functions failure block hosting deploy in CI.
- After merge, confirm GitHub Action **Deploy Firebase Hosting** succeeded before telling users “it’s live”.
