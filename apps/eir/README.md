# @hae/eir — Expert Office Hours (EiR)

People directory for HAE Office Hours, with a **public website** (no login) and a signed-in member/staff workspace.

**Legacy reference:** https://sites.google.com/harvardae.org/experts/home

## Public site (no login)

| Path | Page |
|------|------|
| `/` | Marketing home — Expert Office Hours |
| `/directory` | Searchable people directory (Active experts) |
| `/experts/:id` | Public profile + Book 30 minutes |
| `/how-it-works` | Booking flow |

## Member workspace (login)

| Path | Page |
|------|------|
| `/app` | Staff/member home |
| `/app/directory` | Same directory inside the platform shell |
| `/app/manage` | Staff CRUD for expert profiles |
| `/login` | Sign in → `/app` |

## What staff can manage

Each expert profile supports:

- Name, title, organization, email (email hidden on public pages)
- Bio, expertise tags, LinkedIn URL, photo URL
- Booking URL (Calendly / Google Appointment / etc.)
- Status (Active / Inactive / On Leave) — only Active appear publicly

## Booking today vs later

1. Browse **Directory**
2. Open expert profile
3. Book 30 minutes via their **external booking link**
4. **Later:** in-app scheduling system (not in this release)

## Firestore

Collection: `experts` — Active docs are publicly readable (rules).

## Run

```bash
npm run dev:eir
```
