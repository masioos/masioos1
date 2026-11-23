import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "./schema";

// Server-side use cases of the settings module.

const SUPPORT_PHONE = "support_phone";

/** The support number shoppers call or message, or null when staff have not set it yet. */
export async function getSupportPhone(): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SUPPORT_PHONE));
  return row?.value || null;
}

export async function setSupportPhone(phone: string) {
  await db
    .insert(settings)
    .values({ key: SUPPORT_PHONE, value: phone })
    .onConflictDoUpdate({ target: settings.key, set: { value: phone, updatedAt: new Date() } });
}
