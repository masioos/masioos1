---
name: ship
description: Squash the branch into one commit, open a PR, and merge it into main when pnpm check, pnpm build and /review are green. Use for /ship, or "ثبت کن", "بفرست", "merge".
---

# /ship — put it live in main

There is **no CI**. Your local runs are the only gate. Do not skip any step.

## Refuse when

- The branch is `main`.
- `/review` did not pass in this session → run `/review` first.
- He has not said the feature works for him → ask him to try it (the steps from `/build`).

## Steps

1. `git fetch origin && git rebase origin/main`. Conflicts → fix them, re-run the checks.
2. `pnpm check` → green, zero lint warnings. `pnpm build` → succeeds. Paste the last lines.
3. Squash to one commit (keep a backup first):
   - `git branch backup/<branch>`
   - `git reset --soft origin/main`
   - `git commit -m "<type>(<module>): <what the user can now do> (#<n>)"`
     `type` is `feat`, `fix` or `chore`.
4. `git push -u origin HEAD --force-with-lease`
5. `gh pr create --fill --body "Closes #<n>"`
6. `gh pr merge --squash --delete-branch`
7. `git switch main && git pull --ff-only && git branch -D backup/<branch>`
8. If the change has a new migration, remind him: it applies with `pnpm db:migrate`.
9. Tell him in Persian: done, what is now on the site, and that `/next` picks the next thing.
