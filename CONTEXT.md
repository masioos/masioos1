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
| **Price source** (منبع قیمت) | Where a warehouse's purchase prices come from: by hand, its stock sheet, or «ایساکو» (ISACO's full Excel price file, «قیمت خرده‌فروشی»). |
| **Price history** (تاریخچه‌ی قیمت) | Every purchase-price change of a product, with time and source. |
| **Stock only** (فقط موجودی) | A warehouse setting: its stock sheet changes only what is available; prices come from elsewhere. The other value is «موجودی و قیمت». |
| **Sheet-unavailable** | A good the stock sheet made «ناموجود» because it was missing; a later sheet that has it makes it available again. Goods made unavailable by hand are not. |
| **Price list** (لیست قیمت) | Where a warehouse's prices come from: typed by hand, an uploaded PDF, or an online feed. |
| **Cart** (سبد خرید) | Goods a shopper picked. Not an order yet. |
| **Wish note / Cart note** (توضیحات سبد) | Free text in the cart: goods not in the shop, or more than the quantity limit. Saved by itself while typed. Can be sent with an empty cart. Staff see it as «تیکت». |
| **Account** (حساب کاربری) | A shopper's login: full name, mobile (the login name), optional email, password. Needed only to send a request. |
| **Unit** (واحد) | A product is sold per piece (عدد) or per pair (جفت). Prices are per unit. Cart limit: 4 pieces or 2 pairs. |
| **Confirmation deadline** (مهلت تأیید) | Hours staff give the shopper to accept a confirmed request (default 12). After it the request is expired (منقضی). |
| **Support phone** (شماره پشتیبانی) | Set in admin settings; shoppers call or message it, e.g. to reset a password. |
| **Request** (درخواست) | A submitted cart. Staff may edit rows, then confirm (with a deadline) or reject. The shopper accepts or declines. «ویرایش فاکتور» sends a confirmed or accepted request back to awaiting; staff confirm again and the shopper accepts again. Staff may give each row a discount percent (default 0), and the whole invoice a discount (percent or amount). Staff see each row's profit («پرافیت»), from the purchase price on the day of the request. Statuses: awaiting, confirmed, accepted, cancelled, rejected, declined, expired. The shopper sees awaiting as «در انتظار تأیید فروشگاه». |
| **Confirmation** (تایید) | Staff (and for a bazaar warehouse, its owner) agree to stock and price. Opens payment. Each product names its warehouse, so staff know whom to ask. |
| **Order** (سفارش) | A request the shopper accepted. Has an order status. |
| **Order status** (وضعیت سفارش) | awaiting payment (منتظر پرداخت) → payment sent (پرداخت فرستاده شد) → paid (پرداخت تأیید شد) → collecting (در حال جمع‌آوری) → shipped (ارسال شد); refunded (لغو و برگشت پول) after payment. Unpaid past the deadline → expired. |
| **Payment form** (فرم پرداخت) | What the shopper sends after card-to-card: tracking number, last 4 card digits, date (last 7 days, Persian) and time, optional receipt photo (saved as soon as it is picked). With «بیشتر از یک کارت» one form per card, each with its amount. Staff confirm or answer «پرداخت پیدا نشد» per form; paid when confirmed forms cover the total. |
| **Pay with** (پرداخت با) | The shopper first picks «درگاه پرداخت» (total + the tax and VAT percent set in settings; «به‌زودی» until #20) or «انتقال به کارت» (no tax). |
| **Extra order** (سفارش اضافه) | What staff call the shopper's cart note (green box on the request page). |
| **Delivery method** (روش ارسال) | Chosen by the shopper once, before «پرداخت با»: Tipax, post, courier in our city, pickup at the shop. Tipax and post get a tracking code when shipped. |
| **Refund** (برگشت پول) | Money staff send back to the shopper, one record per transfer with an optional receipt photo the shopper sees. Never more than the confirmed payments. |
| **Pay on delivery** (پس‌کرایه) | Shipping is paid to the courier on delivery; never on the invoice. |
| **Gateway payment** (درگاه پرداخت) | Online payment. Adds about 15% on top of the total (to confirm with the customer). |
| **Card-to-card** (کارت به کارت) | The shopper pays the exact total to a bank card. By default the card of the goods' warehouse; staff can change it per order. |
| **Payee card** (کارت مقصد) | The card one order is paid to. Default: the warehouse with the largest share of the invoice; staff may change it before the payment form arrives. Recorded for accounting. |
| **Accounting** (حسابداری) | Our own accounting software, inside this app as a module. Every paid order becomes an invoice there. |
| **Invoice** (فاکتور) | The accounting record of a sale: who bought what, for how much, paid to which warehouse's card. |
| **Staff** (اپراتور) | The people who sign in to the admin with mobile and password: one **manager** (مدیر) and several **sellers** (فروشنده). |
| **Manager** (مدیر) | Alireza. Manages staff, settings, warehouses and products; always sees purchase price and profit. |
| **Seller** (فروشنده) | Staff who work on requests. Sees purchase price and profit only if the manager allows each one for that seller. The manager can edit a seller's name and mobile, make them inactive, or delete them (gone from the list; their name stays in request history). |
| **Request history** (تاریخچه) | Under each invoice: which staff member confirmed, rejected, reopened or edited it, and when. «آخرین رسیدگی» is the newest one. |
| **Shopper** (مشتری) | A person buying in the shop. |

Open questions from the notes (to settle in `/grill`):

- Is the gateway +15% a fee on the shopper, or the card-to-card price a discount?
- Does accounting push new goods/stock to the shop, or does staff publish them?
