# Agent guide (Cursor, Claude Code, others)

This repo uses shared agent instructions so everyone ships the same way.

## Start here

1. Read **[`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md)** (platform map + task backlog).
2. Read **[`SECRETS.md`](./SECRETS.md)** (GitHub `FIREBASE_TOKEN` vs Gmail/EmailJS — they are different).
3. Read **[`CLAUDE.md`](./CLAUDE.md)** (project facts + non-negotiables).
4. Follow rules in **[`.claude/rules/`](./.claude/rules/)** (coding, UI, Firebase, git).
5. Use skills in **[`.claude/skills/`](./.claude/skills/)** for repeatable workflows.

## Claude Code

- `CLAUDE.md` loads every session.
- Rules in `.claude/rules/` load with the project.
- Skills: invoke with `/ship-pr`, `/add-app-page`, `/firebase-change`, or let Claude auto-select from the skill `description`.

## Cursor

- Same `CLAUDE.md` / `AGENTS.md` context.
- Always-on project rules: `.cursor/rules/*.mdc`.

## Uniform workflow (all agents)

1. Branch from latest `main`.
2. Change only what the task needs; match neighboring code.
3. Update `firestore.rules` / help copy / README when behavior or public surfaces change.
4. `npm run build` (or workspace build) for touched apps before claiming done.
5. Commit with a clear message; open a PR; remember **CI must deploy hosting+rules** for users to see changes (functions are optional / Blaze).

## Do not

- Rebuild auth, shell, or design tokens from scratch.
- Gate public EiR pages behind login (public site is intentional).
- Bundle Cloud Functions into Spark deploys in a way that blocks hosting.
- Add purple/glow “AI default” UI; follow HAE crimson / Inter / existing layouts.
