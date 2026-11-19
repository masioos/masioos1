# Anbarnet — agent contract

Anbarnet is a multi-warehouse online store with its own accounting, for an Iranian business.
One Next.js 16 app (TypeScript), one Postgres, modular monolith. Persian UI, right-to-left.

The person you work with is usually **Alireza, the customer. He is not a programmer.**

- Talk to him in **Persian**, in plain words, short. No jargon; if you must use a term, explain it.
- Write files, code, comments, commits, issues and PRs in **English**.
- UI text the shop shows is Persian. When you write UI text, tell him in Persian what it says.
- Never ask him a technical question you can answer from this repo. Ask him **product** questions.
- Before you say "done", show him what changed in words he can check (a page, a button, a rule).

## How work flows

Alireza can just talk. Or he uses one command: **`/next`**. It reads the board and does the
right next step.

```
idea ──/grill──▶ brief (issue, label "grilled")
     ──/plan───▶ plan in the issue (label "planned")
     ──/build──▶ code on a branch (label "building")
     ──/review─▶ fresh-context AI review, fixes applied
     ──/ship───▶ PR, checks green, merged, issue closed
```

- The board is **GitHub Issues** of this repo (skills use the `gh` CLI).
- Each skill lives in `.claude/skills/<name>/SKILL.md`. Read it when you run the step.
- A request with no issue yet → `/grill` it first, unless it is a tiny fix (a typo, a colour).

## Where to find things

| Need                                              | Read                                  |
| ------------------------------------------------- | ------------------------------------- |
| Words of the business (warehouse, request, card)  | `CONTEXT.md`                          |
| Modules, folders, request path, what is not built | `ARCHITECTURE.md`                     |
| Why the architecture is like this                 | `docs/adr/`                           |
| What the customer said at the start               | `docs/product/brief-2026-11-19.md`    |
| One module's files and rules                      | `src/modules/<name>/AGENTS.md`        |
| Setup on a new PC (Windows)                       | `README.md`                           |

## The check

```
pnpm check
```

Typecheck, lint, tests (`scripts/check.mjs`). A Stop hook runs it when code changed, before you
end a turn. If it fails, fix it — never say "done" with a red check. `/ship` also runs
`pnpm build`. No CI exists: these local runs are the only gate.

## Always

- Put new code in a **module**: `src/modules/<name>/`. Copy the shape of `src/modules/warehouses/`.
- Import another module only through its `index.ts` (`@/modules/<name>`). The lint warns on a deep
  import; fix every warning before `/ship`.
- Keep pages in `src/app/` thin: they place module components, no logic, no DB calls.
- Rules (prices, validation, who may do what) live in the module's `rules.ts`, with a test next to it.
- Validate every form on the server with zod, in the server action.
- DB change → edit the module's `schema.ts`, then `pnpm db:generate` and `pnpm db:migrate`.
  Commit the new file under `src/db/migrations/`.
- A new table → add its module's `schema.ts` to `src/db/schema.ts` (one line).
- Read `process.env` only in `src/env.ts`.
- Components that read the DB go inside `<Suspense>` (Cache Components is on).
- New UI pieces: `pnpm dlx shadcn@latest add <component>`, never a new UI library.

## Ask first (ask Alireza, or say Amir must decide)

- A new npm package.
- A new module, or a change to a module's `index.ts` that another module uses.
- Anything about money: payment gateway, card numbers, prices, the +15% rule, accounting entries.
- Deleting data or a table.

## Never

- Edit a migration that is already committed. Make a new one.
- Commit `.env` or any password, card list or customer data.
- `git push --force`, or push to `main` any way but `/ship`.
- Import from `@/modules/<name>/<file>` outside that module.
- Use `any`, or silence the lint or the type checker.
- Load fonts or scripts from Google or other foreign CDNs (they can be blocked in Iran). Bundle them.

## Platform

Alireza uses **Windows**. Every script is Node (`scripts/*.mjs`), never bash. Paths in docs use `/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
