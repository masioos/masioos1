import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { type NewWarehouse } from "./rules";
import { warehouses } from "./schema";

// Server-side use cases of the warehouses module. Only this module touches its tables.

export async function listWarehouses() {
  return db.select().from(warehouses).orderBy(desc(warehouses.createdAt));
}

export async function createWarehouse(input: NewWarehouse) {
  const [row] = await db.insert(warehouses).values(input).returning();
  return row;
}
