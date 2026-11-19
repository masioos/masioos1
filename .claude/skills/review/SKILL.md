---
name: review
description: Fresh-context AI code review of the current branch against main, then fix what it finds. Use for /review, or before /ship.
---

# /review — a second pair of eyes

A reviewer that did not write the code catches more. Run it in a **subagent**, so it starts with
a fresh context.

## Steps

1. Find the issue number from the branch name (`issue-<n>-...`).
2. Start one subagent (Agent tool, `general-purpose`) with this prompt, filled in:

   > Review the diff `git diff main...HEAD` in this repo for issue #<n>
   > (`gh issue view <n> --comments` has the brief and plan). Read `AGENTS.md` and
   > `ARCHITECTURE.md` first. Report only real problems, most severe first, each with
   > `file:line`, what goes wrong, and the fix:
   > 1. A rule from the brief that the code breaks or does not test.
   > 2. Money: wrong totals, rounding, the wrong card, missing records for accounting.
   > 3. Server trust: a form not validated on the server, data from the browser trusted.
   > 4. Data loss: deletes, overwrites, an edited old migration.
   > 5. Module boundaries: deep imports, a module touching another module's tables.
   > 6. Persian UI: missing text, broken RTL, an error with no message for the user.
   > Do not report style. Do not edit files. If there is nothing, say "no findings".

3. For each finding: check it yourself in the code. Real → fix it. Not real → drop it, say why.
4. `pnpm check` green again. Commit: `git commit -am "wip: review fixes"`.
5. Tell him in Persian, in one or two lines, what the review found and that it is fixed.
   Remember in this session that the review passed — `/ship` needs it.
