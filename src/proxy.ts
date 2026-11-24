import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

// First, quick check for /admin. It only reads the cookie; the real check (session in the DB, 6 idle
// hours, active, role) is `requireStaff()` in every admin component and staff action (src/modules/staff).
//
// Hidden sign-in (ADMIN_LOGIN_PATH set on the live site): the sign-in page lives only at that secret
// address, and /admin/... without a staff cookie looks like a missing page (404), so nobody learns
// where the admin is. Without ADMIN_LOGIN_PATH (a developer PC) /admin/... goes to /admin/login.

/** Same name as STAFF_COOKIE in src/modules/staff/service.ts. */
const STAFF_COOKIE = "anb_staff";
const OPEN_LOGIN = "/admin/login";
const LOGIN = env.ADMIN_LOGIN_PATH;
const hidden = LOGIN !== OPEN_LOGIN;

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (hidden && pathname === LOGIN) return NextResponse.rewrite(new URL(OPEN_LOGIN + search, req.url));
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return NextResponse.next();
  // Hidden mode: the open sign-in address never answers, even with a (made-up) cookie.
  if (hidden && (pathname === OPEN_LOGIN || pathname.startsWith(OPEN_LOGIN + "/"))) {
    return NextResponse.rewrite(new URL("/not-found-page", req.url));
  }
  if (req.cookies.has(STAFF_COOKIE)) return NextResponse.next();
  if (hidden) return NextResponse.rewrite(new URL("/not-found-page", req.url));
  if (pathname === OPEN_LOGIN) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = OPEN_LOGIN;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Every page (the secret address can be anything), not Next's own files or photos.
  matcher: ["/((?!_next/|media/|favicon.ico).*)"],
};
