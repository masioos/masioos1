import { z } from "zod";

// The only place that reads process.env. Add every new variable here and to .env.example.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  // Folder for uploaded product photos. Must be kept in backups (a named volume in production).
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
});

export const env = schema.parse(process.env);
