# HAE Platform — agent instructions

Shared instructions for **Claude Code**, **Cursor**, and other coding agents.
Keep this file short. Details live in `.claude/rules/` and `.claude/skills/`.

## What this repo is

Monorepo for Harvard Alumni Entrepreneurs (HAE) platform apps on **one Firebase project** (`hae-operating-tracker`).

| App | Path | Live |
|-----|------|------|
| Hub | `apps/hub` | https://hae.web.app |
| Operations (Tracker) | `apps/operating-tracker` | https://tracker-hae.web.app |
| LMS | `apps/lms` | https://lms-hae.web.app |
| EiR (Experts) | `apps/eir` | https://eir-hae.web.app (public) + `/app` (members) |
| CRM | `apps/crm` | https://crm-hae.web.app |
| AMS | `apps/ams` | https://ams-hae.web.app |

Shared packages: `@hae/firebase`, `@hae/branding`, `@hae/ui`.

## Stack

- React 18 + Vite + React Router
- Tailwind v4 via `@hae/branding` tokens (`hae-crimson`, `hae-ink`, `hae-slate`, …)
- Firebase Auth (email/password) + Firestore
- Cloud Functions exist under `functions/` but need **Blaze**; default deploy is hosting + rules only (Spark-safe)

## Commands

```bash
npm install
npm run dev:tracker   # :5173
npm run dev:lms       # :5174
npm run dev:crm       # :5175
npm run dev:ams       # :5176
npm run dev:eir       # :5177
npm run build:all
npm run deploy        # hosting + firestore rules (+ auth); NOT functions
npm run deploy:functions  # Blaze only
```

CI: `.github/workflows/deploy-firebase.yml` deploys hosting + rules on `main`; functions are best-effort.

## Non-negotiables

1. **Match existing patterns** in the app you touch (Layout/ModuleShell, Modal, `hae-btn`, Firestore `getDocs` + client filter).
2. **Do not invent parallel design systems** — use HAE tokens from `@hae/branding` / existing utility classes.
3. **RBAC** via `@hae/ui` (`PERMISSIONS`, `ProtectedRoute`, `Can`) — do not hard-code role checks inconsistently.
4. **Feature flags** via `FEATURES` / `useFeatures` when gating optional product surfaces.
5. **Firestore rules** must stay in sync with any new collection or public-read change (`firestore.rules`).
6. **Prefer small PRs** with clear scope; branch names `cursor/<descriptive-name>-****` when using Cursor cloud agents.
7. **Never commit secrets**; Firebase web config in `packages/firebase` is the public client config (expected).

## Where to look

| Need | Location |
|------|----------|
| Coding / UI / Firebase rules | `.claude/rules/` |
| Multi-step workflows | `.claude/skills/*/SKILL.md` (Claude: `/skill-name`) |
| Cursor always-on rules | `.cursor/rules/` |
| Product overview | `README.md` |
| EiR public vs `/app` | `apps/eir/README.md` |

## Communication

- Be direct and concise with the user.
- Prefer implementing over asking when the request is clear.
- Do not estimate calendar time; describe technical scope instead.
