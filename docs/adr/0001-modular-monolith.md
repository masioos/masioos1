# ADR-0001 — One Next.js app, modular monolith, soft boundaries

Status: accepted (2026-11-19, plan `docs/plans/0001-base-setup.md`, D1–D8)

## Context

A non-technical customer builds this with Claude Code. The scope is a store, an accounting
system and later a phone app. Few users (1–3 staff). Hosting on the customer's own server.

## Decision

- TypeScript everywhere. One Next.js 16 app holds shop, admin and accounting. No separate API.
- One shared Postgres, accessed with Drizzle. Each module defines its own tables in `schema.ts`.
- A module is a folder `src/modules/<name>/`. Its `index.ts` is its only public door.
- Boundaries are soft: an ESLint warning on deep imports, no build failure, no per-module schema,
  no events or queues.
- Phones use the site as a PWA. A native app may come later; it would call new route handlers.
- Accounting is a module in the same app, not a separate system.

## Consequences

- One `pnpm dev`, one deploy, one database: the least to break for a vibe coder.
- Modules can drift into each other's tables. The lint and `/review` catch it; nothing enforces it.
- Splitting accounting out later means moving one folder and replacing calls with HTTP.
