# Architecture

What exists now and how the pieces fit. The why is in `docs/adr/0001-modular-monolith.md`.

## Shape

One Next.js 16 app. It is the shop, the admin and (later) the accounting screens. One Postgres
database, shared by every module. The phone version is the same site, installed as a PWA.

```
src/
├── app/                  routes only — thin pages that place module components
│   ├── page.tsx          shop home: search + filters
│   ├── p/[code]/         product page (stable URL by technical code)
│   ├── media/[file]/     product photos from UPLOAD_DIR
│   └── admin/            admin: warehouses, catalog (products, lists, Excel import)
├── modules/<name>/       one business area each
│   ├── index.ts          public surface — the only import door
│   ├── schema.ts         its Drizzle tables
│   ├── rules.ts          pure rules + rules.test.ts
│   ├── service.ts        server-side use cases (DB reads/writes)
│   ├── actions.ts        server actions for forms
│   ├── ui/               its React components
│   └── AGENTS.md         what it owns
├── components/ui/        shadcn components (shared, no business logic)
├── db/                   client.ts, schema.ts (list of module schemas), migrations/
├── lib/                  small shared helpers
└── env.ts                the only reader of process.env
```

## Request path

Browser → Next.js page (`src/app/...`) → module component (Server Component) → module
`service.ts` → Drizzle → Postgres. A form posts to the module's server action (`actions.ts`), which
validates with zod (`rules.ts`) and calls `service.ts`.

## Modules

| Module       | Status   | Owns                                                                   |
| ------------ | -------- | ---------------------------------------------------------------------- |
| `warehouses` | built    | warehouses, their bank card and profit percent (the reference pattern) |
| `catalog`    | built    | goods per warehouse, cars, brands, categories, part groups, Excel import, shop search |
| `pricing`    | planned  | prices: manual, uploaded PDF price list, online feed                   |
| `requests`   | planned  | cart → request, "find this item for me" notes, staff confirmation      |
| `orders`     | planned  | order status: received → paid → collecting → shipped (Tipax / post)    |
| `payments`   | planned  | gateway (+15%) or card-to-card to the warehouse card, editable per order |
| `accounting` | planned  | invoices and ledger; receives every paid order                         |

"Planned" modules come from the customer notes and do not exist yet. Each one starts with a
`/grill`.

## Boundaries (soft)

- Code outside a module imports only `@/modules/<name>`. ESLint warns on a deep import.
- A module reads or writes only its own tables. To use another module's data, call a function that
  module exports from `index.ts`.
- All modules share one DB and one transaction scope. No events, no queues.
- A module's `schema.ts` may import another module's `schema.ts` only to declare a foreign key
  (e.g. `catalog_products.warehouse_id → warehouses.id`). ESLint allows that one import.

## What we do not have yet

- Sign-in. Only 1–3 admins; a password login is likely. The customer decides later.
- Payment gateway, SMS, PDF price parsing, online price feeds.
- CI and deploy pipeline. `Dockerfile` + `compose.prod.yaml` exist; deploy by hand.
- A native mobile app (the PWA covers phones for now).
