# Plan 0001 — Base setup for Anbarnet

Status: **built** (2026-11-19). Decisions D1–D18 were confirmed in four rounds.

## Goal

A base setup that a non-technical customer can "vibe code" with their own Claude account:

1. Architecture and structure: modular monolith for both the backend and the frontend.
2. Instructions for the agent (CLAUDE.md / AGENTS.md, conventions).
3. A product-management process (grilling → brief → plan → build → review → ship).
4. Everything lives in the repo. Nothing depends on Amir's machine or global config.

Inputs: the customer notes of 2026-11-19 (multi-warehouse store, accounting, mobile app later),
and the setups of `metalon` (jcn) and `ff-workspace` (fractionalfirst) as reference.

## Constraints

- The customer is not technical and uses a Claude account (Claude Code).
- Pick the tools and methods that LLMs get right most often.
- Pick the methods that a non-technical person can drive by talking.

## Decisions

| #   | Decision | Choice | Status |
| --- | -------- | ------ | ------ |
| D1  | Language | TypeScript everywhere | ✅ confirmed |
| D2  | Accounting | A module in the same monolith. Minimum complexity: one shared DB, a separate directory, soft boundaries | ✅ confirmed |
| D3  | Customer language | Claude chats in Persian; files, code and docs in English | ✅ confirmed |
| D4  | Mobile | PWA now (installable web store). Native maybe later; grilling asks the customer to confirm | ✅ confirmed |
| D5  | App shape | One Next.js full-stack app. No separate API service. Modules hold DB, logic and UI | ✅ confirmed |
| D6  | DB access | Drizzle ORM on one shared Postgres; each module keeps its tables in its own `schema.ts` | ✅ confirmed |
| D7  | Boundaries | Import another module only through its `index.ts`. An ESLint rule warns on deep imports (warning, not error) | ✅ confirmed |
| D8  | UI | Tailwind + shadcn/ui, RTL (`dir="rtl"`), Vazirmatn font | ✅ confirmed |
| D9  | Auth | Not in the base setup. Only 1–3 people use the admin; a password login is the likely choice. The customer decides in a later grilling | ✅ confirmed (deferred) |
| D10 | Board | GitHub Issues (+ a Project). Skills use the `gh` CLI. The customer, Alireza, uses **Windows**: the README has a `gh` setup step, and Amir reminds Alireza to do it | ✅ confirmed |
| D11 | Commands | One front door `/next` that reads the board and routes to `/grill`, `/plan`, `/build`, `/review`, `/ship`. Plain talk also works | ✅ confirmed |
| D12 | Merge | `/ship` opens a PR and merges it itself when the checks and the AI review are green. No human gate | ✅ confirmed |
| D13 | Grilling | One question per turn, in Persian, with a recommended answer; ends with a brief the customer confirms | ✅ confirmed |
| D14 | Platform | Every script and hook runs on Windows, macOS and Linux: Node scripts only, no bash | ✅ derived from D10 |
| D15 | Checks | Local only, no CI. `pnpm check` = typecheck + lint + tests. A Stop hook runs it before Claude ends a turn; `/ship` runs it again before merge | ✅ confirmed |
| D16 | Local DB | Docker Desktop + Postgres (`compose.yaml`). The README has a Windows Docker Desktop step | ✅ confirmed |
| D17 | AI review | `/review` runs a fresh-context subagent on the diff, on the customer's Claude account; findings are fixed before `/ship` merges | ✅ confirmed |
| D18 | Deploy | A `Dockerfile` and a prod `compose` file (app + Postgres). No deploy pipeline until the server exists | ✅ confirmed |

⚠️ Risk of D12 + D15: nothing outside Alireza's PC checks a merge. Main protection on GitHub is
not possible without a required status check. Accepted: `/ship` refuses to merge unless
`pnpm check` and `/review` were green in the same session.

## What gets built

```
anbarnet/
├── CLAUDE.md            one line: @AGENTS.md
├── AGENTS.md            agent contract: routing table, Always / Ask first / Never, checks
├── ARCHITECTURE.md      modules, request path, what we do not have yet
├── CONTEXT.md           domain glossary (warehouse, request, card-to-card…) from the notes
├── README.md            setup for Windows: Node, pnpm, Docker Desktop, gh, Claude Code
├── docs/
│   ├── product/brief-2026-11-19.md   the customer notes, kept as the source
│   ├── adr/0001-modular-monolith.md  D2, D5, D6, D7 as one ADR
│   └── plans/                        plans like this one
├── .claude/
│   ├── settings.json    permissions + Stop hook (node .claude/hooks/check.mjs)
│   ├── hooks/check.mjs
│   └── skills/next, grill, plan, build, review, ship
├── compose.yaml         Postgres for dev
├── Dockerfile, compose.prod.yaml
└── src/
    ├── app/             thin routes only: (shop)/, admin/, api/
    ├── modules/<m>/     index.ts (public), schema.ts, service.ts, ui/, *.test.ts
    ├── components/ui/   shadcn
    └── db/              drizzle client, migrations
```

- Example module: `warehouses` end to end (table, service, admin list page, one test), so the
  agent copies a real pattern.
- Planned modules listed in ARCHITECTURE only: catalog, pricing, cart/requests, orders, payments,
  accounting.
- The `web/` folder generated earlier moves to the repo root (single app).
- GitHub labels the skills use: `idea`, `grilled`, `planned`, `building`, plus `kind:*`.

## Rounds

### Round 1 — stack, backend, accounting, language

- D1, D2, D3 confirmed.
- Amir asked: does the customer need a native mobile app, or is a PWA enough? This decides D5.
- Notes evidence: voice note 1 says "later there will also be a mobile app"; voice note 2 lists
  "a mobile app" as scope item 3, after the store. No native-only need (camera, push, offline) is
  named.

## Notes

- The `web/` Next.js app generated before brainstorming moved to the repo root (D5).
- Next 16 turns on Cache Components: DB reads sit inside `<Suspense>`, not `dynamic = ...`.
- Follow-up for Amir: remind Alireza to install and log in to `gh` on Windows (README step 5).
