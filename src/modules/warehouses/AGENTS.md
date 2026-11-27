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

The list is edited in place and saves by itself (`ui/warehouse-row.tsx` → `saveWarehouseAction`, one
part at a time: name + owner, card + holder once 16 digits, profit). Each row has a button that opens
that warehouse's blue panel (`?w=<id>`, `selectedWarehouse`), drawn by catalog (`WarehousePanel`):
stock sheet on the right, prices on the left; the ISACO warehouse's panel is titled «ایساکو».
Depends on `settings` (`getIsacoWarehouseId`, to title the ISACO row's button «ایساکو») and `staff`.
Order: `position` (▲ ▼ at the end of each row, `moveWarehouse`; a new warehouse goes last).
`sheet_mode` is no longer used (catalog's `sheetModeFor`: ISACO warehouse → only stock); the column
stays until a migration removes it.
| `actions.ts`          | server actions for forms                                |
| `ui/`                 | React components                                        |

This module is the reference pattern. A new module copies this shape.
