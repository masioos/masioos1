import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { DEFAULT_GATEWAY_TAX_PERCENT } from "./rules";
import { settings } from "./schema";

// Server-side use cases of the settings module.

const SUPPORT_PHONE = "support_phone";
const GATEWAY_TAX = "gateway_tax_percent";

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

/** Percent added on top of the total when paying by gateway (tax and VAT). Default 10. */
export async function getGatewayTaxPercent(): Promise<number> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, GATEWAY_TAX));
  const n = Number(row?.value);
  return row && Number.isInteger(n) ? n : DEFAULT_GATEWAY_TAX_PERCENT;
}

export async function setGatewayTaxPercent(percent: number) {
  const value = String(percent);
  await db
    .insert(settings)
    .values({ key: GATEWAY_TAX, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

const ISACO_WAREHOUSE = "isaco_warehouse_id";

/** The one warehouse whose purchase prices come from ISACO's price file (#8), or null. */
export async function getIsacoWarehouseId(): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, ISACO_WAREHOUSE));
  return row?.value || null;
}

/** Set by catalog's ISACO page (manager only; the caller checks the warehouse exists). */
export async function setIsacoWarehouseId(warehouseId: string) {
  await db
    .insert(settings)
    .values({ key: ISACO_WAREHOUSE, value: warehouseId })
    .onConflictDoUpdate({ target: settings.key, set: { value: warehouseId, updatedAt: new Date() } });
}
