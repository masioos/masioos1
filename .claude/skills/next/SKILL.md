---
name: next
description: The front door for Alireza. Reads the GitHub board and the working tree, says in Persian what the next step is, and runs the right skill (/grill, /plan, /build, /review, /ship). Use when the user types /next, or asks "what now", "what should I do", "چی کار کنم", "بعدی چیه".
argument-hint: "[optional: an idea or an issue number]"
---

# /next — what to do now

Speak Persian to the user. Keep it to a few short lines.

## 1. Check the machine (silently, once per session)

- `gh auth status`. If not logged in → tell him in Persian to run `gh auth login` (README step 5)
  and stop.
- `git status --short` and `git branch --show-current`.

## 2. Pick the next step — first match wins

1. **He typed an idea** (`$ARGUMENTS` is text, not a number) → run `/grill` with it.
2. **Uncommitted work or a feature branch exists** → find its issue (branch name `issue-<n>-...`).
   - code not finished → continue `/build <n>`.
   - code finished, not reviewed in this session → `/review`.
   - reviewed → `/ship`.
3. **An issue labeled `building`** → `/build <n>`.
4. **An issue labeled `planned`** → offer to `/build` the oldest one.
5. **An issue labeled `grilled`** → `/plan <n>`.
6. **An issue labeled `idea`** → `/grill <n>`.
7. **Nothing open** → ask him in Persian what he wants the shop to do next. Suggest the next
   planned module from `ARCHITECTURE.md` § Modules.

Read the labels with:
`gh issue list --state open --json number,title,labels --limit 50`

## 3. Say it, then do it

One line in Persian: what you found and what you will do. Example:
"درخواست #۱۲ (ثبت کالا) آماده‌ی ساخت است. شروع می‌کنم."
Then run that skill. Ask only if two choices are equally good.
