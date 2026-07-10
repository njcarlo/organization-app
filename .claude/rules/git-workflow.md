---
description: Git branching, PRs, and deploy verification for this repo
alwaysApply: true
---

# Git & PR workflow

## Branches

- Branch from latest `main`.
- Cursor cloud agents: `cursor/<descriptive-kebab>-<suffix>` (lowercase).
- Prefer one concern per branch/PR.

## Commits

- Imperative subject; explain *why* in the body when non-obvious.
- Do not commit `node_modules`, `.env`, or Firebase CI tokens.

## Pull requests

- Title describes user-visible outcome.
- Body: problem, approach, test plan.
- Mention required Console/manual steps (OAuth secrets, email templates, Blaze) explicitly.

## After merge

- Check Actions: hosting + rules must be green for public/site changes.
- If users still see old UI: CDN/cache — hard refresh; confirm `last-modified` on the hosting site.
- Functions warnings on Spark are expected; do not “fix” by re-adding functions to the blocking deploy step.
