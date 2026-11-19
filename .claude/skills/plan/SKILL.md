---
name: plan
description: Turn a grilled GitHub issue into a short technical plan (modules, files, tables, tests) and post it as an issue comment. Use for /plan <issue>, or when an issue has the "grilled" label and no plan.
argument-hint: "<issue number>"
---

# /plan — how we will build it

The user does not read this plan's technical part. You write it for the agent that runs `/build`.

## Steps

1. `gh issue view <n> --comments`. If there is no brief (no `## Rules` / `## Done when`) → run
   `/grill <n>` first.
2. Read `AGENTS.md`, `ARCHITECTURE.md`, `CONTEXT.md`, and the `AGENTS.md` of every module it touches.
   Read `src/modules/warehouses/` as the pattern.
3. Decide, following `AGENTS.md` § Always:
   - Which module owns it. A new module → **ask first** (say it in Persian, one line, with why).
   - Tables and columns (in that module's `schema.ts`).
   - Pure rules in `rules.ts`, one test per rule in the brief.
   - Service functions, server actions, UI components, pages.
   - What another module must export from its `index.ts`.
4. Keep it the smallest version that meets **Done when**. No extras.
5. Post it: `gh issue comment <n> --body-file <tmp file>` with this shape:

```markdown
## Plan
Module: `<name>` (new | existing)

### Data
- table `x`: columns…

### Steps
1. Each step one change, with the file. Last step: `pnpm check` green.

### Tests
- `rules.test.ts`: one line per rule from the brief.

### Risks
- Anything that touches money, data deletion, or another module's index.ts.
```

6. `gh issue edit <n> --add-label planned --remove-label grilled`
7. Tell him in Persian, in two lines, what will be built (no tech words), and that `/next` builds it.
