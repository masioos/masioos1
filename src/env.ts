import { z } from "zod";

// The only place that reads process.env. Add every new variable here and to .env.example.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  // Folder for uploaded product photos. Must be kept in backups (a named volume in production).
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  // Hidden staff sign-in address on the live site, e.g. "/panel-x7k2" (lower-case letters, digits, "-").
  // Without it the sign-in page is the open "/admin/login" (fine on a developer PC only).
  ADMIN_LOGIN_PATH: z
    .string()
    .regex(/^\/[a-z0-9][a-z0-9-]{2,39}(\/[a-z0-9][a-z0-9-]{1,39})?$/, "ADMIN_LOGIN_PATH: like /panel-x7k2")
    // Must not be a page the shop already has.
    .refine(
      (p) => p === "/admin/login" || !/^\/(admin|account|cart|requests|p|media|api)(\/|$)/.test(p),
      "ADMIN_LOGIN_PATH must not be an address the shop already uses",
    )
    .default("/admin/login"),
});

export const env = schema.parse(process.env);
