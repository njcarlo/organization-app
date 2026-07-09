# @hae/operating-tracker

**Milestone 1 — COMPLETE**

Central hub for HAE leadership to monitor programs, projects, and tasks.

**Live:** https://hae-operating-tracker.web.app

## Modules

| Module | Route | Status |
|--------|-------|--------|
| Dashboard | `/` | Done |
| Programs + Projects + Tasks | `/programs/:programId` | Done |
| My Tasks | `/my-tasks` | Done |
| Admin (Users / Programs) | `/admin` | Done |
| Auth + Setup | `/login`, `/setup` | Done |

## Run locally

From repo root:

```bash
npm install
npm run dev:tracker
```

## Data

Firestore collections: `users`, `programs`, `projects`, `tasks`

First install: visit `/setup` while `users` is empty.
