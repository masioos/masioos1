import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatProfitPercent } from "../rules";
import { listWarehouses } from "../service";
import { ProfitForm } from "./profit-form";

// Server Component: reads the list straight from the service.
export async function WarehouseTable() {
  const rows = await listWarehouses();
  if (rows.length === 0) return <p>هنوز انباری ثبت نشده است.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>نام انبار</TableHead>
          <TableHead>صاحب انبار</TableHead>
          <TableHead>شماره کارت</TableHead>
          <TableHead>درصد سود</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((w) => (
          <TableRow key={w.id}>
            <TableCell>{w.name}</TableCell>
            <TableCell>{w.ownerName}</TableCell>
            <TableCell dir="ltr">{w.cardNumber}</TableCell>
            <TableCell>
              <ProfitForm id={w.id} percent={formatProfitPercent(w.profitBp)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
