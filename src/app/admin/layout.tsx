import { Suspense } from "react";
import { RequestsMenuBadge } from "@/modules/requests";
import { StaffMenu } from "@/modules/staff";

// Admin menu for whoever is signed in (#9). Each page checks the sign-in itself; this only draws links.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="bg-muted/40 flex flex-wrap items-center gap-4 border-b px-8 py-3 text-sm">
        <Suspense fallback={<span className="font-bold">مدیریت</span>}>
          <StaffMenu
            requestsBadge={
              <Suspense fallback={null}>
                <RequestsMenuBadge />
              </Suspense>
            }
          />
        </Suspense>
      </nav>
      {children}
    </div>
  );
}
