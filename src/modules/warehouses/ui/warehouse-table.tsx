import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listWarehouses } from "../service";

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
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((w) => (
          <TableRow key={w.id}>
            <TableCell>{w.name}</TableCell>
            <TableCell>{w.ownerName}</TableCell>
            <TableCell dir="ltr">{w.cardNumber}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
