# Anbarnet

A multi-warehouse online store with its own accounting. Persian, right-to-left.
You build it by talking to Claude Code. Start with `/next`.

## Set up a Windows PC (one time, ~30 min)

Do these in order. Each step says what you should see.

1. Install **Git**: https://git-scm.com/download/win → in a new terminal, `git --version` prints a version.
2. Install **Node.js 24 LTS**: https://nodejs.org → `node -v` prints `v24...`.
3. Turn on **pnpm**: run `corepack enable` in a terminal opened as Administrator → `pnpm -v` prints a version.
4. Install **Docker Desktop**: https://www.docker.com/products/docker-desktop → open it; the whale icon says "Engine running".
5. Install **GitHub CLI**: `winget install --id GitHub.cli` → then run `gh auth login`, pick GitHub.com, HTTPS, log in with the browser → `gh auth status` says "Logged in".
6. Install **Claude Code** and log in with your Claude account: https://claude.com/claude-code → `claude` opens.
7. Get the code: `gh repo clone masioos/masioos1 anbarnet` then `cd anbarnet`.
8. Install packages: `pnpm install` → ends with "Done".
9. Start the database and set it up: `pnpm setup:local` → ends with "✔ ready".
10. Start the site: `pnpm dev` → open http://localhost:3000.

## Every day

1. Open Docker Desktop.
2. In the `anbarnet` folder run `claude`.
3. Type `/next`. Claude tells you what is next and asks you questions in Persian.

## Commands

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `pnpm dev`           | runs the site at http://localhost:3000          |
| `pnpm check`         | typecheck + lint + tests — must be green        |
| `pnpm setup:local`   | first-time database setup                       |
| `pnpm db:generate`   | makes a migration after a `schema.ts` change    |
| `pnpm db:migrate`    | applies migrations to the local database        |
| `pnpm db:studio`     | opens a browser view of the database            |

## For developers

Read `AGENTS.md` (rules), `ARCHITECTURE.md` (shape) and `CONTEXT.md` (words).
