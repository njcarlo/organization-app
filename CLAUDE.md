# HAE Platform (organization-app)

Monorepo: one app per milestone module (`apps/operating-tracker`, `apps/lms`, `apps/eir`, `apps/crm`, `apps/ams`), shared Firebase/branding/UI packages (`packages/*`). See README.md for full layout, commands, and Firebase details.

## Workflow rule: PRs for review

Never push code changes directly to `main`. For any code change (feature, fix, refactor, docs affecting behavior), work on a branch and open a pull request for **njcarlo** to review before merging.

- Create a feature branch off `main` (e.g. `git checkout -b <descriptive-name>`).
- Commit the change, push the branch, and open a PR with `gh pr create`.
- Assign/request review from **njcarlo** (`gh pr edit <PR> --add-reviewer njcarlo` or mention them in the PR body if reviewer assignment isn't available).
- Do not merge the PR yourself — leave it open for njcarlo's review/approval unless explicitly told otherwise.
