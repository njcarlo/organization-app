# HAE Platform (Monorepo)

One repo, **one app per milestone module**. Shared Firebase + branding packages.

**Live (Operating Tracker):** https://hae-operating-tracker.web.app  
**Public brand site:** https://www.harvardae.org/

---

## Layout

```
hae-platform/
├── apps/
│   ├── operating-tracker/   ✅ Milestone 1 — live
│   ├── lms/                 🔲 Milestone 2 — stub
│   ├── crm/                 🔲 Milestone 3 — stub
│   └── ams/                 🔲 Milestone 4 — stub
├── packages/
│   ├── firebase/            Shared Auth + Firestore clients
│   └── branding/            HAE fonts, colors, theme CSS
├── firebase.json            Hosting / Auth / Firestore (root)
├── firestore.rules
└── package.json             npm workspaces root
```

| App | Package name | Milestone | Status |
|-----|--------------|-----------|--------|
| Operating Tracker | `@hae/operating-tracker` | 1 | Live |
| LMS | `@hae/lms` | 2 | Planned stub |
| CRM | `@hae/crm` | 3 | Planned stub |
| AMS | `@hae/ams` | 4 | Planned stub |

**Yes — this is a monorepo:** each milestone is its own Vite/React app under `apps/`, with shared code in `packages/`. Later you can host each app on its own Firebase Hosting site or subdomain without splitting repos.

---

## Commands

```bash
npm install

# Milestone 1 (default)
npm run dev                 # same as dev:tracker
npm run build:tracker
npm run deploy              # build tracker + firebase deploy

# Future modules (stubs until scaffolded)
npm run dev:lms
npm run dev:crm
npm run dev:ams
```

---

## Shared packages

### `@hae/firebase`
Primary + secondary Auth apps and Firestore `db` for `hae-operating-tracker`.

### `@hae/branding`
Tokens and Tailwind theme from harvardae.org (Archivo Black, Libre Franklin, crimson `#b80028`).

---

## First-time setup (Operating Tracker)

1. Open https://hae-operating-tracker.web.app/setup (only when `users` is empty)
2. Create admin — seeds 11 programs
3. Sign in at `/login`

---

## Adding the next milestone

1. Replace the stub in `apps/<module>/` with a Vite React app (copy `operating-tracker` as a starting point)
2. Depend on `@hae/firebase` and `@hae/branding`
3. Add a Hosting target in `firebase.json` when ready to deploy separately
4. Keep module-specific Firestore collections in that app’s domain

---

## Firebase

- Project: `hae-operating-tracker`
- Hosting currently serves **Operating Tracker** (`apps/operating-tracker/dist`)
- Auth: email/password
- Rules: authenticated read/write (`firestore.rules`)

### Operating Tracker modules

- **Dashboard** (`/`) — This Week’s Priorities, Upcoming, Waiting On, Attention Required, Wins
- **Programs** (`/programs/:programId`) — projects + inline tasks
- **My Tasks** (`/my-tasks`) — personal / all-tasks (admin) with filters
- **Admin** (`/admin`) — users (via secondary Auth app) + programs

### Collections

`users`, `programs`, `projects`, `tasks`
