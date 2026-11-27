import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { type NewWarehouse, type SheetMode } from "./rules";
import { warehouses } from "./schema";

// Server-side use cases of the warehouses module. Only this module touches its tables.

export async function listWarehouses() {
  return db.select().from(warehouses).orderBy(desc(warehouses.createdAt));
}

export async function createWarehouse(input: NewWarehouse) {
  const [row] = await db.insert(warehouses).values(input).returning();
  return row;
}

export async function setWarehouseCard(id: string, cardNumber: string, cardHolder: string) {
  await db.update(warehouses).set({ cardNumber, cardHolder }).where(eq(warehouses.id, id));
}

export async function setWarehouseProfit(id: string, profitBp: number) {
  await db.update(warehouses).set({ profitBp }).where(eq(warehouses.id, id));
}

export async function setWarehouseSheetMode(id: string, sheetMode: SheetMode) {
  await db.update(warehouses).set({ sheetMode }).where(eq(warehouses.id, id));
}

/** Profit (basis points) per warehouse id. Used by catalog to compute shop prices. */
export async function getWarehouseProfits(ids: readonly string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: warehouses.id, profitBp: warehouses.profitBp })
    .from(warehouses)
    .where(inArray(warehouses.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.profitBp]));
}
