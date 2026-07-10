---
name: ship-pr
description: Branch, implement, build, commit, push, and open a PR the HAE way. Use when finishing a feature, fixing a bug for review, or the user asks to ship/PR/merge-ready changes.
---

# Ship a PR

## Steps

1. `git fetch origin main && git checkout main && git pull origin main`
2. Create branch: `cursor/<short-kebab>-<id>` (or team’s normal prefix).
3. Implement with minimal diff; follow `.claude/rules/*`.
4. Build touched workspaces, e.g. `npm run build --workspace=@hae/eir`.
5. If Firestore/public behavior changed, include `firestore.rules` (and help/README if user-facing).
6. Commit with a clear message; push `-u origin HEAD`.
7. Open a PR against `main` with summary + test plan.
8. Reminder: users only see hosting changes after CI **Deploy Firebase Hosting** succeeds.

## Do not

- Force-push `main`.
- Include unrelated refactors.
- Claim “live” without checking the workflow run.
