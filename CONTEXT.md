# Context — the words of the business

One word, one meaning. Use these words in code, issues and chat. Persian in brackets.

| Term | Meaning |
| ---- | ------- |
| **Warehouse** (انبار) | A stock owner whose goods the shop sells: our own stock, a supplier, or a seller in the bazaar ("warehouse of Mr. A"). Has its own goods, prices and bank card. |
| **Goods / Product** (کالا) | An item a warehouse offers. Belongs to exactly one warehouse; the same part from another brand or warehouse is another product. Its technical code (کد فنی) is unique. |
| **Purchase price** (قیمت خرید) | What the goods cost us, in Toman. Staff only. Empty = «برای قیمت تماس بگیرید». |
| **Profit percent** (درصد سود) | Set per warehouse. Added on top of the purchase price. Staff only. |
| **Shop price** (قیمت فروش سایت) | Purchase price + warehouse profit, rounded down to 1,000 Toman. The only price a shopper sees. |
| **Part group** (گروه قطعه) | Products that are the same part from different brands. Shown as «مدل‌های دیگر این قطعه». |
| **Car** (خودرو) | A car model a product fits (e.g. Peugeot 405). A product fits zero or more cars. |
| **Country of origin** (کشور سازنده) | Where a product is made. Shown and filterable. |
| **Active** (فعال) | A product the shop shows. Inactive products are hidden everywhere in the shop. |
| **Unavailable** (ناموجود) | A product shown with the «ناموجود» label; it cannot go in the cart. |
| **Stock sheet** (فایل موجودی) | A supplier's Excel list (e.g. `Mojoodi_4104070_*.xlsx`): code, name, car, price in Rial. |
| **Price list** (لیست قیمت) | Where a warehouse's prices come from: typed by hand, an uploaded PDF, or an online feed. |
| **Cart** (سبد خرید) | Goods a shopper picked. Not an order yet. |
| **Wish note** (درخواست کالای ناموجود) | Free text in the cart: "I want this item; if you find it, give it to me." |
| **Request** (درخواست) | A submitted cart. Staff must confirm stock and price before the shopper can pay. |
| **Confirmation** (تایید) | Staff (and for a bazaar warehouse, its owner) agree to stock and price. Opens payment. Each product names its warehouse, so staff know whom to ask. |
| **Order** (سفارش) | A confirmed request. Has a status. |
| **Order status** (وضعیت سفارش) | received → awaiting payment → payment confirmed → being collected → shipped (Tipax / post / other courier). |
| **Gateway payment** (درگاه پرداخت) | Online payment. Adds about 15% on top of the total (to confirm with the customer). |
| **Card-to-card** (کارت به کارت) | The shopper pays the exact total to a bank card. By default the card of the goods' warehouse; staff can change it per order. |
| **Payee card** (کارت مقصد) | The card one order is paid to. Recorded for accounting. |
| **Accounting** (حسابداری) | Our own accounting software, inside this app as a module. Every paid order becomes an invoice there. |
| **Invoice** (فاکتور) | The accounting record of a sale: who bought what, for how much, paid to which warehouse's card. |
| **Staff** (اپراتور) | The 1–3 people who confirm requests and run the admin. |
| **Shopper** (مشتری) | A person buying in the shop. |

Open questions from the notes (to settle in `/grill`):

- Is the gateway +15% a fee on the shopper, or the card-to-card price a discount?
- Does accounting push new goods/stock to the shop, or does staff publish them?
