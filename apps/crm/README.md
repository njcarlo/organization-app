# @hae/crm — HAE Relationships (CRM)

**Milestone 3**

Staff/admin console for relationship management across alumni, donors, partners,
and prospects.

## Features

- **Dashboard** with pipeline totals by stage, recent interactions, and upcoming follow-ups
- **Contacts** CRUD — type, region, tags, pipeline stage, notes, follow-up date
- **Interactions** — log emails, calls, meetings, and notes linked to contacts
- **Pipeline** — board + table filtered by stage (prospect → engaged → committed → closed)

## Collections

`contacts`, `interactions` (pipeline stage stored on contact; optional `pipelines` records supported if added later)

## Run

```bash
npm run dev:crm
```

Opens on port 5175.
