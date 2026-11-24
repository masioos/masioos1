# Module: requests

The cart and requests staff confirm (#5). Depends on `catalog`, `customers`, `warehouses` through
their `index.ts`; nothing depends on `requests`.

| File          | What                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `schema.ts`   | `requests_carts`, `requests_cart_lines`, `requests_requests`, `requests_rows`, `requests_messages` |
| `rules.ts`    | quantity limits, cart/request totals, `canSubmit`, `canConfirm`, statuses, `canDo`, deadline, form schemas + tests |
| `service.ts`  | cart, submit, shopper reads/steps, staff reads/edits/confirm/reject, attention counts     |
| `actions.ts`  | server actions (all zod-validated)                                                        |
| `ui/`         | add-to-cart, cart page, site header links, shopper request pages, staff pages, alert     |

Rules:
- Cart without sign-in (cookie `anb_cart`); on sign-in the browser cart is joined into the shopper's.
- Max per line: 4 pieces or 2 pairs. More → the cart note.
- Today's shop price in the cart; prices are copied into the request at submission.
- Statuses: awaiting → confirmed → accepted; cancelled / rejected / declined; `expired` is computed
  (confirmed + deadline passed). `canDo(action, status)` is the single table of who may do what;
  updates also check the stored status (and the deadline for accept) inside the SQL.
- Staff edit rows only while awaiting. «ویرایش فاکتور» (action `reopen`) moves a confirmed, expired or
  accepted request back to awaiting, with a store message; the shopper must accept the new invoice.
- Staff rows save by themselves (no «ذخیره» button). Each row has a discount, whole percent 0–100,
  default 0; `rules.rowTotal` rounds the row amount to whole Toman. Shoppers see a «تخفیف» column
  when any row has one.
- Whole-invoice discount: the «تخفیف» box beside «جمع کل» (percent or Toman amount, saves by
  itself, only while awaiting). `rules.invoiceTotals` caps it at the rows sum.
- Staff «پرافیت» column (#15): row amount after its discount − purchase price × quantity; the total
  takes off the invoice discount. Rows keep the purchase price of the day they were made
  (`purchase_price_toman`, from `getPurchasePrices` of catalog). Shoppers never get it: `getMyRequest`
  blanks it. A row with no purchase price (a free row) gets its profit typed by staff
  (`manual_profit_toman`, used only when the purchase price is unknown). Confirmation needs every remaining row priced. Deadline:
  staff hours, default 12, max 168.
- Messages go both ways (`requests_messages.from_shopper`). Staff have one message box: «فرستادن پیام»,
  «تأیید» (sends it too) and «رد» (it is the reason). The shopper may write while awaiting,
  confirmed or accepted (`canDo("shopperMessage")`).
- Alerts (`ui/alerts.tsx`, sounds in `ui/sounds.ts`, Web Audio, no file):
  admin polls every 3 s — `staff_seen_at` null → request sound, `staff_unread_message_at` set →
  message sound; opening the request clears both. A signed-in shopper polls every 5 s —
  `customer_notify_at` > `customer_seen_at` → header marker + shopper sound.
- Reads that use the clock call `connection()` first (Cache Components).
