import { listProductFormOptions } from "../service";
import { ImportForm } from "./import-form";

export async function StockSheetImport() {
  const { warehouses } = await listProductFormOptions();
  if (warehouses.length === 0) return <p>اول یک انبار بسازید.</p>;
  return <ImportForm warehouses={warehouses} />;
}
