import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriceText } from "@/modules/catalog";
import { getCurrentCustomer } from "@/modules/customers";
import { removeFromCartAction } from "../actions";
import { canSubmit, isProblemLine } from "../rules";
import { getCartView } from "../service";
import { QuantitySelect, SubmitForm } from "./cart-forms";
import { fa, toman } from "./format";
import { goodsBoxClass, TotalFooter } from "./request-view";

/** The cart: today's prices, flagged lines, total, note, address and «ثبت درخواست». */
export async function CartPage() {
  const [cart, customer] = await Promise.all([getCartView(), getCurrentCustomer()]);
  const check = canSubmit(cart.lines, cart.note);
  const blocked = !check.ok && cart.lines.some(isProblemLine) ? check.error : null;

  return (
    <div className="flex flex-col gap-6">
      {cart.lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p>سبد خالی است.</p>
          <ShopMoreButton label="جست‌وجوی کالا" />
        </div>
      ) : (
        <div className={goodsBoxClass}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">ردیف</TableHead>
                <TableHead>کالا</TableHead>
                <TableHead>قیمت واحد</TableHead>
                <TableHead>تعداد</TableHead>
                <TableHead>جمع</TableHead>
                <TableHead className="w-24 text-center">حذف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.lines.map((l, i) => {
                const problem = isProblemLine(l);
                return (
                  <TableRow key={l.productId} className={problem ? "bg-destructive/5" : ""}>
                    <TableCell className="text-center">{fa(i + 1)}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      <Link href={`/p/${encodeURIComponent(l.code)}`} className="font-medium hover:underline">
                        {l.name}
                      </Link>
                      <span className="text-muted-foreground block text-end text-xs" dir="ltr">
                        {l.code}
                      </span>
                      {problem && (
                        <span className="text-destructive block text-sm">
                          این کالا دیگر موجود نیست. لطفاً آن را از سبد بردارید.
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <PriceText toman={l.shopPriceToman} unit={l.unit} />
                    </TableCell>
                    <TableCell>
                      {!problem && <QuantitySelect productId={l.productId} unit={l.unit} quantity={l.quantity} />}
                    </TableCell>
                    <TableCell>
                      {problem || l.shopPriceToman === null ? "—" : toman(l.shopPriceToman * l.quantity)}
                    </TableCell>
                    <TableCell className="text-center">
                      <form action={removeFromCartAction}>
                        <input type="hidden" name="productId" value={l.productId} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label={`حذف ${l.name}`}
                        >
                          <Trash2 className="size-4" />
                          حذف
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TotalFooter cols={5} total={cart.total} hasUnpriced={cart.hasUnpriced} trailing={1} />
          </Table>
          <div className="border-t p-3">
            <ShopMoreButton label="چیزی جا مانده؟ افزودن کالای دیگر به سبد" />
          </div>
        </div>
      )}
      <SubmitForm note={cart.note} signedIn={!!customer} lastAddress={customer?.lastAddress ?? ""} blocked={blocked} />
    </div>
  );
}

/** A large button back to the shop, for goods the shopper forgot. */
function ShopMoreButton({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 w-full gap-2 border-2 border-dashed text-base" })}
    >
      <Plus className="size-5" />
      {label}
    </Link>
  );
}
