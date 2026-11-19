import { z } from "zod";

// The only place that reads process.env. Add every new variable here and to .env.example.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const env = schema.parse(process.env);
