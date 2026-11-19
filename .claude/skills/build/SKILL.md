---
name: build
description: Implement a planned GitHub issue on its own branch, following AGENTS.md and the plan comment, until pnpm check is green. Use for /build <issue>, or when an issue is labeled "planned" or "building".
argument-hint: "<issue number>"
---

# /build — write the code

## Start

1. `gh issue view <n> --comments`. No `## Plan` comment → run `/plan <n>` first.
2. Branch: `git switch main && git pull --ff-only`, then `git switch -c issue-<n>-<short-slug>`.
   If the branch exists, `git switch` to it and continue.
3. `gh issue edit <n> --add-label building --remove-label planned`
4. Make sure the DB runs: if `pnpm db:migrate` fails, ask him in Persian to open Docker Desktop.

## Build

- Follow the plan's steps in order. Follow `AGENTS.md` § Always / Never.
- Write the `rules.ts` tests first, from the brief's **Rules**. Then make them pass.
- Schema change → `pnpm db:generate` → `pnpm db:migrate`.
- Commit after each working step: `git add -A && git commit -m "wip: <step>"`.
- If the plan is wrong or a rule is unclear, **stop and ask him** a product question (one, in
  Persian, with options). Never guess money rules.

## Finish

1. `pnpm check` green, with **zero** lint warnings.
2. Check the page in the browser yourself (dev server from `.claude/launch.json`) when you can.
3. Tell him in Persian what to try: the URL, what to click, what he should see — one line per
   **Done when** item. Ask him to try it.
4. Then: "اگر درسته، /next را بزن تا بررسی و ثبت شود."
