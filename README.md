# HAE Platform (Monorepo)

One repo, **one app per milestone module**. Shared Firebase + branding packages.

**Live (Operating Tracker):** https://hae-operating-tracker.web.app  
**Public brand site:** https://www.harvardae.org/

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
├── packages/
│   ├── firebase/            Shared Auth + Firestore clients
│   ├── branding/            HAE fonts, colors, theme CSS
│   └── ui/                  Shared auth shell + module nav
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
npm run deploy        # Operating Tracker hosting
```

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
