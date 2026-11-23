import Link from "next/link";
import { getCurrentCustomer, LogoutButton } from "@/modules/customers";
import { cartItemCount, myUnseenCount } from "../service";
import { ShopperAlert } from "./alerts";
import { fa } from "./format";

/** Top bar of the shop: cart count, account, and a marker when staff answered a request. */
export async function SiteHeaderLinks() {
  const customer = await getCurrentCustomer();
  const [items, unseen] = await Promise.all([cartItemCount(), customer ? myUnseenCount(customer.id) : 0]);
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <Link href="/cart" className="hover:underline">
        سبد خرید{items > 0 && <span className="bg-primary text-primary-foreground ms-1 rounded-full px-2">{fa(items)}</span>}
      </Link>
      {customer ? (
        <>
          <Link href="/requests" className="hover:underline">
            درخواست‌های من
            {unseen > 0 && (
              <span className="ms-1 rounded-full bg-amber-500 px-2 text-white" title="پاسخ تازه از فروشگاه">
                {fa(unseen)}
              </span>
            )}
          </Link>
          <ShopperAlert initial={unseen} />
          <span className="text-muted-foreground">{customer.fullName}</span>
          <LogoutButton />
        </>
      ) : (
        <Link href="/account/login" className="hover:underline">
          ورود / ثبت‌نام
        </Link>
      )}
    </div>
  );
}
