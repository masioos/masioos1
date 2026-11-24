# Module: staff

People who sign in to `/admin` (#9): one manager and several sellers. Depends on no business module;
every module with admin pages or staff actions depends on it (`requireStaff` / `requireManager`).

| File          | What                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `schema.ts`   | `staff_users`, `staff_sessions`                                               |
| `rules.ts`    | roles, `canSee` (purchase price / profit), `can`, `newPassword`, schemas + tests |
| `service.ts`  | sign in / out, `getCurrentStaff`, `requireStaff`, `requireManager`, sellers page, `noteStaffAction`, `getStaffNames` |
| `actions.ts`  | sign-in, sign-out, add seller, «رمز جدید», switches                           |
| `ui/`         | sign-in form, `StaffMenu` (admin nav), `StaffTable`, `ManagerOnly` / `StaffOnly` page guards |

Rules:
- Sign-in is mobile + password (`src/lib/password.ts`, scrypt). Wrong mobile, wrong password and
  inactive give one message.
- Session: random token in the httpOnly cookie `anb_staff`, only its sha256 in the DB. It ends after
  6 hours without activity (`IDLE_HOURS`, DB clock) or on «خروج». `last_seen_at` moves at most once a minute.
- `src/proxy.ts` only checks the cookie exists (quick redirect). The real check is `requireStaff()` /
  `requireManager()`: **every** admin page (through the module component or `ManagerOnly` / `StaffOnly`)
  and **every** staff server action calls one. A new staff action must too.
- Manager only: staff, settings, warehouses, product edit / import / lists. Sellers: requests,
  customers, the product list (read-only).
- Purchase price and profit: the manager always sees them; a seller only with that switch on
  (`canSee`). Profit permission needs the purchase price on the server, so a seller who sees profit
  could work out a purchase price.
- Wrong passwords: 5 for one mobile within 15 minutes close sign-in for that mobile, even with the
  right password (`staff_sign_in_failures`; a right password clears them; rows older than a day are dropped).
- Hidden sign-in: `ADMIN_LOGIN_PATH` (server env, e.g. `/panel-x7k2`) is the only sign-in address on the
  live site; `/admin/...` without a staff cookie answers 404 (`src/proxy.ts`). Unset = open `/admin/login`.
  Sign-out and expired sessions go to `LOGIN_PATH`. Nothing on the shop links to the admin.
- Nobody sees a password. «رمز جدید» makes one and shows it once; it signs that seller out.
- Staff are never deleted (request history points at them). Inactive = cannot sign in, signed out at once.
- The manager is made on the server: `pnpm staff:manager 09121234567 "Full Name"` (also resets the
  manager's password). Never commit the printed password.
