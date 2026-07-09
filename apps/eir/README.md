# @hae/eir — Expert Office Hours (EiR)

Dynamic expert directory for HAE Office Hours.

**Reference (not a data copy):** https://sites.google.com/harvardae.org/experts/home

## What staff can manage

Each expert profile supports:

- Name, title, organization, email
- Bio
- Expertise tags
- LinkedIn URL
- Booking URL (Calendly / Google Appointment / etc.)
- Photo URL
- Status (Active / Inactive / On Leave)

## Member flow

1. Browse **Directory** (search + expertise filter)
2. Open expert profile
3. Book 30 minutes via booking link
4. Share goals in the booking form

## Firestore

Collection: `experts`

## Run

```bash
npm run dev:eir
```
