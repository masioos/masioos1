// Public surface of the warehouses module. Code outside this folder imports ONLY from here:
//   import { WarehouseTable } from "@/modules/warehouses";
// Add an export here when another module or a page needs it. Keep everything else private.
// listWarehouses / getWarehouseProfits are server-only: never import this file from a client component.

export { CreateWarehouseForm } from "./ui/create-warehouse-form";
export { WarehouseTable } from "./ui/warehouse-table";
export { getWarehouseProfits, listWarehouses } from "./service";
export type { Warehouse } from "./schema";
