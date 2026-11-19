# Module: warehouses

Owns the warehouses: each supplier or bazaar seller is one warehouse, with its own goods, prices
and bank card (CONTEXT.md § Warehouse).

| File                  | What                                                    |
| --------------------- | ------------------------------------------------------- |
| `index.ts`            | public surface — the only file other code imports       |
| `schema.ts`           | Drizzle tables (`warehouses`)                           |
| `rules.ts`            | pure validation (card number, names) + `rules.test.ts`  |
| `service.ts`          | server-side use cases (list, create)                    |
| `actions.ts`          | server actions for forms                                |
| `ui/`                 | React components                                        |

This module is the reference pattern. A new module copies this shape.
