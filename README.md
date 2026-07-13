# HAE Platform (Monorepo)

One repo, **one app per milestone module**. Shared Firebase + branding packages.

**Live hub (landing):** https://hae.web.app  
**Tracker:** https://tracker-hae.web.app  
**Public brand site:** https://www.harvardae.org/

Each app shares a **top platform header** (switch Hub / Tracker / LMS / EiR / CRM / AMS). The **left sidenav is scoped to the selected app** only.

### Agents (Claude Code / Cursor)

Shared workflow + coding standards for anyone (or any agent) working in this repo:

- [`AGENTS.md`](./AGENTS.md) — how to work here
- [`CLAUDE.md`](./CLAUDE.md) — project facts loaded by Claude Code
- [`.claude/rules/`](./.claude/rules/) — coding, UI, Firebase, git
- [`.claude/skills/`](./.claude/skills/) — `/ship-pr`, `/add-app-page`, `/firebase-change`
- [`.cursor/rules/`](./.cursor/rules/) — Cursor always-on rules

---

## Layout

```
hae-platform/
├── apps/
│   ├── operating-tracker/   ✅ Milestone 1 — COMPLETE
│   ├── lms/                 ✅ Milestone 2 — Academy LMS
│   ├── eir/                 ✅ Expert Office Hours (EiR directory)
│   ├── crm/                 ✅ Milestone 3 — CRM
│   └── ams/                 ✅ Milestone 4 — AMS
│   └── hub/                 Landing page (hae.web.app)
├── packages/
│   ├── firebase/            Shared Auth + Firestore clients
│   ├── branding/            HAE fonts, colors, theme + hub CSS
│   └── ui/                  Shared auth shell + module nav + header
├── firebase.json
├── firestore.rules
└── package.json
```

| App | Package | Milestone | Status |
|-----|---------|-----------|--------|
| Operating Tracker | `@hae/operating-tracker` | 1 | Complete / Live |
| LMS (Academy) | `@hae/lms` | 2 | Built |
| Experts (EiR) | `@hae/eir` | 2 | Built (dynamic directory) |
| CRM | `@hae/crm` | 3 | Built |
| AMS | `@hae/ams` | 4 | Built |
| Platform insights | cross-app | **5** | Complete |

### Milestone 5 — Platform insights & ops polish

Cross-app improvements for feedback, awareness, calendar handoff, person linking, and account recovery (Spark-safe; no Cloud Functions).

| Feature | Where | Notes |
|---------|--------|--------|
| Survey analytics + CSV export | Tracker → Surveys → editor | Choice/rating breakdowns, text samples, CSV download |
| Notifications digest | Tracker → Notifications | Overdue / due-soon tasks + LMS check-ins; optional mailto digest |
| ICS calendar export | Tracker My Tasks, LMS Office Hours, AMS Events | Download `.ics` for Google/Apple/Outlook |
| CRM ↔ AMS/LMS person linking | CRM → Contacts → Edit | Match by email; show members, memberships, enrollments, certificates |
| URL attachments | CRM contacts & interactions | Paste Drive/Dropbox/SharePoint links (no Storage required) |
| Password reset | All login pages + Admin → Users | Firebase `sendPasswordResetEmail`; admin can trigger per user |
| Put emails in Auth | Admin → Users | Bulk paste emails → creates Firebase Auth accounts + sends reset emails |

**Superadmins** (always full access + Feature toggles): `njcarlo@gmail.com`, `inahmarchadesch@gmail.com`  
Tracker → Admin → **Features** — turn apps/features on or off for everyone else.

Deferred (needs Blaze / custom domain): automated push email via Cloud Functions, nested `app.hae.web.app` DNS.

---

## Commands

```bash
npm install

npm run dev:tracker   # :5173
npm run dev:lms       # :5174
npm run dev:crm       # :5175
npm run dev:ams       # :5176
npm run dev:eir       # :5177

npm run build:all
npm run deploy        # all hosting targets + firestore rules
npm run import:real   # upsert production programs/projects/tasks/users
```

### Auto-deploy (GitHub Actions)

Pushes to `main` (and manual **Run workflow**) build all apps and deploy Firebase Hosting + Firestore rules. Cloud Functions deploy is attempted separately and is allowed to fail on Spark (Blaze required for functions).

1. Generate a CI token locally: `npx firebase login:ci`
2. Add it as a repo secret named `FIREBASE_TOKEN`  
   (GitHub → Settings → Secrets and variables → Actions)
3. Merge to `main` — workflow: `.github/workflows/deploy-firebase.yml`

---

## Live URLs

Primary pattern: **`[app]-hae.web.app`** (Firebase Hosting site IDs cannot use dots, so nested `app.hae.web.app` is not available on `web.app`).

| App | Primary | Legacy (still deployed) |
|-----|---------|-------------------------|
| Hub | https://hae.web.app | Landing with people photography |
| Tracker | https://tracker-hae.web.app | https://hae-operating-tracker.web.app |
| LMS | https://lms-hae.web.app | https://hae-lms.web.app |
| EiR | https://eir-hae.web.app | https://hae-eir.web.app |
| CRM | https://crm-hae.web.app | https://hae-crm.web.app |
| AMS | https://ams-hae.web.app | https://hae-ams.web.app |

Add each primary host under Firebase Console → Authentication → Settings → Authorized domains if sign-in fails on a new URL.

---

## EiR / Expert Office Hours

Public people directory + member workspace for SME Office Hours.

| Surface | URL |
|---------|-----|
| **Public site** (no login) | https://eir-hae.web.app — home, directory, profiles, how it works |
| **Member workspace** | https://eir-hae.web.app/app — staff manage + signed-in browse |
| Legacy Google Sites (reference) | https://sites.google.com/harvardae.org/experts/home |

- Active experts are publicly readable; booking uses each expert’s external `bookingUrl` for now
- In-app scheduling is deferred to a later milestone
- Firestore collection: `experts`

---

## LMS (Academy)

Aligned to HAE Academy model: Academy vs Flagship paths, enrollments, office hours, 30/60/180-day check-ins, certificates.

**Public LMS sample was private** (Google Site login). Built from [harvardae-academy.org](https://www.harvardae-academy.org/) + Academy 2026 as reference.

Collections: `courses`, `modules`, `enrollments`, `sessions`, `checkIns`, `certificates`

---

## CRM / AMS

- CRM: `contacts`, `interactions` (+ pipeline stages)
- AMS: `members`, `memberships`, `events`, `committees`

---

## Firebase

- Project: `hae-operating-tracker`
- Multi-site Hosting targets: `tracker`, `lms`, `eir`, `crm`, `ams`
- Auth: email/password
- Rules: authenticated read/write (`firestore.rules`)

### Password reset / email action links

Firebase sometimes sends password-reset links with an empty `apiKey=`, which makes the default hosted page (`/__/auth/action`) show **“The selected page mode is invalid.”**

This repo serves a custom handler at **`/auth/action`** on every app (uses the configured Firebase API key via the client SDK). Point Auth email templates at it:

1. Firebase Console → **Authentication** → **Templates**
2. Edit **Password reset** (and optionally **Email address verification** / **Email address change**)
3. Customize action URL to:

```
https://tracker-hae.web.app/auth/action?mode=%MODE%&oobCode=%OOB_CODE%&apiKey=%API_KEY%&lang=%LANG%
```

4. Save, then send a fresh reset email (old links keep the broken hosted URL)

**Immediate workaround for an already-open broken link (after this handler is deployed):** in the address bar, change `/__/auth/action` → `/auth/action` (keep the same query string) and reload. The custom page ignores an empty `apiKey`. Alternately, paste the web API key after `apiKey=` (Project settings → Your apps).

**Project-level fix (often restores default `/__/auth/action` links):** Authentication → Sign-in method → delete **Email/Password** → re-enable it (does not delete existing users).

### Executive Inbox (PR #39)

Allowlisted users: `rmarchadesch@harvardae.org`, `rryan@harvardae.org`.

Before Connect / Sync work in production:

1. Blaze plan + deploy functions (`npm run deploy` / CI now includes `functions`)
2. Enable Gmail API + Google Calendar API on the GCP project
3. Create an OAuth 2.0 Web client; authorized redirect URI must be exactly:
   `https://us-east1-hae-operating-tracker.cloudfunctions.net/oauthCallback`
4. Set secrets:
   `firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET ANTHROPIC_API_KEY`
5. An allowlisted user opens Operations → Executive Inbox → **Connect Google Account**, then **Sync now**

### Operations modules

- **Dashboard** (`/`) — This Week’s Priorities, Upcoming, Waiting On, Attention Required, Wins
- **Programs** (`/programs/:programId`) — projects + inline tasks
- **My Tasks** (`/my-tasks`) — personal / all-tasks (admin) with filters
- **Admin** (`/admin`) — users (via secondary Auth app) + programs

### Tracker collections

`users`, `programs`, `projects`, `tasks`
