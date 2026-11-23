import { z } from "zod";

/** A real UUID from the URL, checked before it reaches the database. */
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
