# HAE Operating Tracker

Web app for **Harvard Alumni Entrepreneurs (HAE)** leadership and staff to monitor programs, projects, and tasks.

**Live:** https://hae-tracker.vercel.app

## Tech stack

- React 18 + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Router v6
- Firebase (Auth email/password + Firestore)
- Vercel SPA (`vercel.json` rewrites)

## Milestone status

| Milestone | Status |
|-----------|--------|
| 1 — Operating Tracker | Implemented in this repo |
| 2 — LMS | Planned |
| 3 — CRM | Planned |
| 4 — AMS | Planned |

## Local development

```bash
npm install
npm run dev
```

### Firebase config

Edit `src/firebase.js` with your Firebase web app config (apiKey, authDomain, projectId, etc.).

Enable **Email/Password** auth in the Firebase console.

Suggested Firestore rules (tighten for production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### First-time setup

1. Open `/setup` while the `users` collection is empty.
2. Create the admin account — this also seeds the 11 default programs.
3. Sign in at `/login`.

### Deploy to Vercel

1. Push this repo and import it in Vercel.
2. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.
3. `vercel.json` already rewrites all routes to `index.html`.

### Deploy notes for Firebase Hosting (optional)

If you prefer Firebase Hosting instead of Vercel:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist, SPA rewrite: yes
npm run build
firebase deploy --only hosting
```

## App modules

- **Dashboard** (`/`) — This Week’s Priorities, Upcoming, Waiting On, Attention Required, Wins
- **Programs** (`/programs/:programId`) — projects + inline tasks
- **My Tasks** (`/my-tasks`) — personal / all-tasks (admin) with filters
- **Admin** (`/admin`) — users (via secondary Auth app) + programs

## Collections

`users`, `programs`, `projects`, `tasks`
