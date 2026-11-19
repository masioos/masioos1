// Public surface of the warehouses module. Code outside this folder imports ONLY from here:
//   import { WarehouseTable } from "@/modules/warehouses";
// Add an export here when another module or a page needs it. Keep everything else private.

export { CreateWarehouseForm } from "./ui/create-warehouse-form";
export { WarehouseTable } from "./ui/warehouse-table";
export type { Warehouse } from "./schema";
