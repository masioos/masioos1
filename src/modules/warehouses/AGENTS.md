# Module: warehouses

Owns the warehouses: each supplier or bazaar seller is one warehouse, with its own goods, prices
and bank card (CONTEXT.md § Warehouse).

| File                  | What                                                    |
| --------------------- | ------------------------------------------------------- |
| `index.ts`            | public surface — the only file other code imports       |
| `schema.ts`           | Drizzle tables (`warehouses`)                           |
| `rules.ts`            | pure validation (card number, names, profit %) + tests  |
| `service.ts`          | list, create, set profit, `getWarehouseProfits` (catalog) |

Profit is stored as basis points (`profit_bp`, 1000 = 10%). Changing it changes the shop price of all
the warehouse's products at once (catalog computes the shop price on read).

`sheet_mode` (#2): what the warehouse's Excel stock sheet changes — «موجودی و قیمت» (`stock_and_price`,
default) or «فقط موجودی» (`stock_only`: prices come from elsewhere). Set per row in the table; catalog
reads it through `listWarehouses`.
| `actions.ts`          | server actions for forms                                |
| `ui/`                 | React components                                        |

This module is the reference pattern. A new module copies this shape.
