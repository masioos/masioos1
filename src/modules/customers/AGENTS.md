# Module: customers

Shopper accounts and sign-in sessions (#5). Depends on no business module; `requests` depends on it.

| File          | What                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| `schema.ts`   | `customers`, `customers_sessions`                                              |
| `rules.ts`    | mobile normalizing, register/login/address schemas, `safeNextPath` + tests     |
| `password.ts` | scrypt hash / verify (Node built-in, no package)                               |
| `service.ts`  | register, login, logout, `getCurrentCustomer`, staff `setPassword`, lists      |
| `actions.ts`  | server actions for the forms                                                   |
| `ui/`         | login, register, forgot-password text, staff customers table                   |

Rules:
- Login is mobile + password. One account per mobile (`09xxxxxxxxx`, Persian digits and +98 accepted).
- Sessions: random token in the httpOnly cookie `anb_session`, only its sha256 in the DB, 30 days.
  Expiry is compared with the DB clock (`now()`), never `new Date()` during rendering.
- Wrong mobile and wrong password give the same message.
- Forgot password: no SMS yet (#12). The page shows the support number; staff set a new password in
  `/admin/customers`, which signs the shopper out everywhere.
- Personal data: never commit a dump of these tables.
