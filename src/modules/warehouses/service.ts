import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { moveInOrder, type NewWarehouse } from "./rules";
import { warehouses } from "./schema";

// Server-side use cases of the warehouses module. Only this module touches its tables.

/** In the manager's order (▲ ▼); a new warehouse goes to the end. */
export async function listWarehouses() {
  return db.select().from(warehouses).orderBy(asc(warehouses.position), desc(warehouses.createdAt));
}

export async function createWarehouse(input: NewWarehouse) {
  const [row] = await db
    .insert(warehouses)
    .values({ ...input, position: sql`(select coalesce(max(${warehouses.position}), -1) + 1 from ${warehouses})` })
    .returning();
  return row;
}

/** ▲ ▼: one place up or down; the whole list is numbered again 0, 1, 2… */
export async function moveWarehouse(id: string, direction: "up" | "down") {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: warehouses.id })
      .from(warehouses)
      .orderBy(asc(warehouses.position), desc(warehouses.createdAt))
      .for("update");
    const order = moveInOrder(
      rows.map((r) => r.id),
      id,
      direction,
    );
    for (const [position, wid] of order.entries()) {
      await tx.update(warehouses).set({ position }).where(eq(warehouses.id, wid));
    }
  });
}

export async function setWarehouseInfo(id: string, name: string, ownerName: string) {
  await db.update(warehouses).set({ name, ownerName }).where(eq(warehouses.id, id));
}

export async function setWarehouseCard(id: string, cardNumber: string, cardHolder: string) {
  await db.update(warehouses).set({ cardNumber, cardHolder }).where(eq(warehouses.id, id));
}

export async function setWarehouseProfit(id: string, profitBp: number) {
  await db.update(warehouses).set({ profitBp }).where(eq(warehouses.id, id));
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
