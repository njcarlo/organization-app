---
name: firebase-change
description: Safely change Firestore collections, security rules, Auth email actions, or hosting/deploy behavior. Use when touching firestore.rules, public reads, Auth templates, or CI deploy.
---

# Firebase change

## Rules first

1. Edit `firestore.rules` in the **same PR** as code that needs the new access.
2. For public data: allow only the minimum (e.g. `status == 'Active'`), and constrain client queries to match.
3. Never rely on “hiding fields in the UI” alone for secrets; prefer not storing sensitive fields on public docs when possible.

## Auth

- Password reset / verify: prefer `/auth/action` custom handler; document Console template URL if emails still hit `/__/auth/action`.
- Admin user create: use `secondaryAuth` so the admin session is not replaced.

## Deploy

- Hosting + rules: `npm run deploy` or CI (Spark OK).
- Functions: only with Blaze via `npm run deploy:functions`; CI must not fail the whole job when functions fail.
- After merge, verify the GitHub Action and the live host `last-modified` / bundle hash.

## Functions code

- Live under `functions/`; region `us-east1` to match `packages/firebase`.
- Secrets via `defineSecret`; never hardcode keys.
