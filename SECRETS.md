# Secrets & credentials (for developers)

This repo uses **different secret stores for different jobs**.  
**`FIREBASE_TOKEN` is only for GitHub Actions deploy — it is not a Gmail key and cannot be reused for email services.**

---

## Quick map

| Secret | Where it lives | Who uses it | What it’s for |
|--------|----------------|-------------|----------------|
| `FIREBASE_TOKEN` | **GitHub Actions** repo secret | CI only (`.github/workflows/deploy-firebase.yml`) | Deploy Hosting / rules / Functions to Firebase |
| `VITE_EMAILJS_*` | **GitHub Actions** repo secrets (baked into the web build) | Browser (EmailJS) | Optional @mention emails from the client |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | **Firebase Functions secrets** (Secret Manager) | Cloud Functions | Executive Inbox Gmail + Calendar OAuth |
| `ANTHROPIC_API_KEY` | **Firebase Functions secrets** | Cloud Functions | Classify Exec Inbox email |
| `RESEND_API_KEY` | **Firebase Functions** env/secret (optional) | Cloud Functions | Alternate server-side mention email |

Local developers normally **do not** need `FIREBASE_TOKEN`. Push to `main` and CI deploys with the repo secret.

---

## 1. How other developers know secrets exist

### GitHub Actions secrets (including `FIREBASE_TOKEN`)

1. Open the repo on GitHub → **Settings** → **Secrets and variables** → **Actions**  
   (needs admin / maintain access; collaborators without Settings access won’t see values — by design)
2. Names are also listed in:
   - This file (`SECRETS.md`)
   - `.github/workflows/deploy-firebase.yml` (`secrets.FIREBASE_TOKEN`, `secrets.VITE_EMAILJS_*`)
   - `README.md` → Auto-deploy

**You cannot read secret values after they’re saved** — only names. Ask a repo admin if something is missing.

### Firebase / Gmail secrets (not in GitHub)

Gmail is **not** wired through `FIREBASE_TOKEN`. Exec Inbox uses OAuth client secrets on the Functions side:

```bash
# List / set (requires Firebase project access + Blaze for Functions)
firebase functions:secrets:access GOOGLE_OAUTH_CLIENT_ID   # if permitted
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
firebase functions:secrets:set ANTHROPIC_API_KEY
```

Documented under **Executive Inbox** in `README.md`.

---

## 2. `FIREBASE_TOKEN` — deploy only

**Create / rotate (admins):**

```bash
npx firebase login:ci
# Paste the token into GitHub → Settings → Secrets → Actions → FIREBASE_TOKEN
```

**What CI does with it:**

- `firebase deploy --only hosting,firestore:rules`
- Best-effort `firebase deploy --only functions`

**What it is not:**

- Not a Gmail API credential
- Not for EmailJS
- Not for local `npm run dev`
- Not something to paste into other SaaS “API key” fields

If a developer needs to deploy from their laptop, they use **their own** `firebase login` (or a personal CI token), not by exporting the GitHub secret into random tools.

---

## 3. Email services (Gmail / EmailJS / Resend)

### A) @mention email via EmailJS (client, Spark-friendly)

Used by `packages/ui/src/mentionEmail.js`. CI injects these at **build** time:

| GitHub secret | Becomes |
|---------------|---------|
| `VITE_EMAILJS_SERVICE_ID` | `import.meta.env.VITE_EMAILJS_SERVICE_ID` |
| `VITE_EMAILJS_TEMPLATE_ID` | `import.meta.env.VITE_EMAILJS_TEMPLATE_ID` |
| `VITE_EMAILJS_PUBLIC_KEY` | `import.meta.env.VITE_EMAILJS_PUBLIC_KEY` |

**Local testing:** create `apps/operating-tracker/.env.local` (do not commit):

```bash
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```

Ask a repo admin for the EmailJS dashboard values if you need to develop mention email locally. The **public** key is designed for browser use; still don’t commit it if the team prefers CI-only injection.

### B) Executive Inbox Gmail sync (server)

Uses Google OAuth + Functions — **separate** from GitHub `FIREBASE_TOKEN`:

1. GCP: enable Gmail API + Calendar API  
2. OAuth Web client; redirect  
   `https://us-east1-hae-operating-tracker.cloudfunctions.net/oauthCallback`  
3. `firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET ANTHROPIC_API_KEY`  
4. Allowlisted user connects in Tracker → Executive Inbox  

See `README.md` → Executive Inbox.

### C) Resend (optional Functions path)

Server-side mention mail via `onMentionNotificationCreated` needs `RESEND_API_KEY` on Functions (Blaze). Independent of GitHub `FIREBASE_TOKEN`.

---

## 4. Checklist for a new developer

1. Clone repo → `npm install` → `npm run dev:tracker` (no secrets required for basic UI work)
2. Read this file + `README.md`
3. To confirm CI deploy works: check Actions on `main` (green = `FIREBASE_TOKEN` is set)
4. For email features: ask an admin which path is live (EmailJS vs Resend vs mailto draft) and for the right credentials store (GitHub vs Firebase secrets)
5. **Never** commit tokens, OAuth client secrets, or `.env.local` files

---

## 5. Who can add / rotate secrets

| Store | Typical role |
|-------|----------------|
| GitHub Actions secrets | Repo admin / owner |
| Firebase Functions secrets | Someone with Firebase project Editor+ and `firebase` CLI access |
| EmailJS dashboard | Whoever owns the EmailJS account tied to HAE |

If you’re blocked, ask the repo owners (`njcarlo@gmail.com` / project superadmins) rather than inventing a second token store.
