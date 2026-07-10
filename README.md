# HAE Platform (Monorepo)

One repo, **one app per milestone module**. Shared Firebase + branding packages.

**Live hub (landing):** https://hae.web.app  
**Tracker:** https://tracker-hae.web.app  
**Public brand site:** https://www.harvardae.org/

Each app shares a **top platform header** (switch Hub / Tracker / LMS / EiR / CRM / AMS). The **left sidenav is scoped to the selected app** only.

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

Pushes to `main` (and manual **Run workflow**) build all apps and deploy Firebase Hosting + Firestore rules.

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

Dynamic SME directory staff can manage (add/edit experts with bio, expertise, LinkedIn, booking link).

**Reference only (not a data copy):** https://sites.google.com/harvardae.org/experts/home

Firestore collection: `experts`

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

### Operating Tracker modules

- **Dashboard** (`/`) — This Week’s Priorities, Upcoming, Waiting On, Attention Required, Wins
- **Programs** (`/programs/:programId`) — projects + inline tasks
- **My Tasks** (`/my-tasks`) — personal / all-tasks (admin) with filters
- **Admin** (`/admin`) — users (via secondary Auth app) + programs

### Tracker collections

`users`, `programs`, `projects`, `tasks`
